/**
 * Standalone audit server — bypasses Next.js entirely.
 * Serves the classifier and photo audit UIs on port 3001.
 *
 * Usage: npx tsx scripts/audit-server.ts
 * Open: http://localhost:3001
 */
import "dotenv/config";
import { createServer, IncomingMessage, ServerResponse } from "http";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL, max: 5 });
const prisma = new PrismaClient({ adapter });
const PORT = 3001;

const CORRECTIONS_PATH = join(__dirname, "../src/lib/agents/menu-classifier/corrections.json");

const VALID_TYPES = ["dish", "dessert", "drink", "alcohol", "side", "condiment", "addon", "combo", "kids"];

async function handleClassifierGet(url: URL, res: ServerResponse) {
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const filter = url.searchParams.get("filter") || "needs-review";
  const limit = 50;
  const skip = (page - 1) * limit;

  let where: any;
  if (filter === "all") {
    where = { archivedAt: null };
  } else if (filter === "dish-cards") {
    where = { archivedAt: null, isDishCard: true };
  } else if (filter === "not-dish-cards") {
    where = { archivedAt: null, isDishCard: false, menuItemType: { not: "unknown" as const } };
  } else {
    where = {
      archivedAt: null,
      source: { not: "backfill" as const },
      OR: [
        { auditConfidence: { lt: 0.7 } },
        { menuItemType: "unknown" as const },
        { dishCardConfidence: { lt: 0.7 } },
        { dishCardConfidence: null, isDishCard: true },
      ],
    };
  }

  const [items, total] = await Promise.all([
    prisma.menuItem.findMany({
      where,
      select: {
        id: true, name: true, description: true, price: true, category: true,
        menuItemType: true, isDishCard: true, dishCardConfidence: true, auditConfidence: true,
        restaurant: { select: { name: true } },
      },
      orderBy: [{ auditConfidence: { sort: "asc", nulls: "first" } }, { lastSeenAt: "desc" }],
      skip, take: limit,
    }),
    prisma.menuItem.count({ where }),
  ]);

  const mapped = items.map((item) => ({
    id: item.id, name: item.name, description: item.description,
    price: item.price ? Number(item.price) : null, category: item.category,
    menuItemType: item.menuItemType, isDishCard: item.isDishCard,
    dishCardConfidence: item.dishCardConfidence ? Number(item.dishCardConfidence) : null,
    auditConfidence: item.auditConfidence ? Number(item.auditConfidence) : null,
    restaurantName: item.restaurant.name,
  }));

  json(res, { success: true, data: { items: mapped, total, page } });
}

async function handleClassifierPost(body: any, res: ServerResponse) {
  const { menuItemId, correctType, isDishCard, action } = body;
  if (!menuItemId) return json(res, { error: "menuItemId required" }, 400);

  const existing = await prisma.menuItem.findUnique({
    where: { id: menuItemId },
    select: { name: true, menuItemType: true, dishId: true },
  });
  if (!existing) return json(res, { error: "Not found" }, 404);

  if (action === "reject") {
    await prisma.menuItem.update({
      where: { id: menuItemId },
      data: { archivedAt: new Date(), archivedReason: "junk_detected", isDishCard: false, auditConfidence: 1.0, dishCardConfidence: 1.0 },
    });
    if (existing.dishId) {
      await prisma.dish.update({ where: { id: existing.dishId }, data: { isAvailable: false } }).catch(() => {});
    }
    logCorrection(menuItemId, existing.name, existing.menuItemType, null, "rejected");
    return json(res, { success: true, rejected: true });
  }

  if (correctType && !VALID_TYPES.includes(correctType)) {
    return json(res, { error: `Invalid type: ${correctType}` }, 400);
  }

  const isAlcohol = correctType === "alcohol";
  const shouldBeDishCard = isDishCard !== undefined ? !!isDishCard : isAlcohol ? false : undefined;

  await prisma.menuItem.update({
    where: { id: menuItemId },
    data: {
      ...(correctType ? { menuItemType: correctType } : {}),
      auditConfidence: 1.0,
      dishCardConfidence: 1.0,
      ...(shouldBeDishCard !== undefined ? { isDishCard: shouldBeDishCard } : {}),
    },
  });

  if (isAlcohol && existing.dishId) {
    await prisma.menuItem.update({ where: { id: menuItemId }, data: { dishId: null, isDishCard: false } });
    await prisma.dish.update({ where: { id: existing.dishId }, data: { isAvailable: false } }).catch(() => {});
  }

  logCorrection(menuItemId, existing.name, existing.menuItemType, correctType || null, null);
  json(res, { success: true, updated: true });
}

async function handlePhotosGet(url: URL, res: ServerResponse) {
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"));
  const filter = url.searchParams.get("filter") || "unreviewed";
  const limit = Math.min(Number(url.searchParams.get("limit") || "50"), 100);
  const skip = (page - 1) * limit;

  const where = filter === "low-confidence" ? { analyzedAt: { not: null } } : { analyzedAt: null };

  const [items, total] = await Promise.all([
    prisma.dishPhoto.findMany({
      where, select: {
        id: true, dishId: true, sourceUrl: true, sourcePlatform: true, analyzedAt: true,
        dish: { select: { name: true, restaurant: { select: { name: true, cuisineType: true } }, menuItems: { select: { id: true }, take: 1 } } },
      },
      orderBy: { createdAt: "desc" }, skip, take: limit,
    }),
    prisma.dishPhoto.count({ where }),
  ]);

  const mapped = items.map((item) => ({
    photoId: item.id, dishId: item.dishId, menuItemId: item.dish.menuItems[0]?.id || null,
    dishName: item.dish.name, photoUrl: item.sourceUrl, restaurantName: item.dish.restaurant.name,
    cuisine: item.dish.restaurant.cuisineType?.join(", ") || "", sourcePlatform: item.sourcePlatform,
  }));

  json(res, { success: true, data: { items: mapped, total, page } });
}

async function handlePhotosPost(body: any, res: ServerResponse) {
  const { photoId, dishId, action } = body;
  if (!photoId) return json(res, { error: "photoId required" }, 400);

  if (action === "approve") {
    await prisma.dishPhoto.update({ where: { id: photoId }, data: { analyzedAt: new Date() } }).catch(() => null);
    return json(res, { success: true, action: "approved" });
  }
  if (action === "reject") {
    await prisma.dishPhoto.delete({ where: { id: photoId } }).catch(() => null);
    return json(res, { success: true, action: "rejected" });
  }
  if (action === "demote" && dishId) {
    await prisma.dishPhoto.delete({ where: { id: photoId } }).catch(() => null);
    await prisma.dish.update({ where: { id: dishId }, data: { isAvailable: false } }).catch(() => null);
    await prisma.menuItem.updateMany({ where: { dishId }, data: { isDishCard: false, dishCardConfidence: 1.0 } }).catch(() => null);
    return json(res, { success: true, action: "demoted" });
  }
  if (action === "remove-all" && dishId) {
    await prisma.dishPhoto.delete({ where: { id: photoId } }).catch(() => null);
    await prisma.dish.update({ where: { id: dishId }, data: { isAvailable: false } }).catch(() => null);
    await prisma.menuItem.updateMany({ where: { dishId }, data: { isDishCard: false, archivedAt: new Date(), archivedReason: "junk_detected", auditConfidence: 1.0 } }).catch(() => null);
    return json(res, { success: true, action: "removed-all" });
  }
  json(res, { error: "Invalid action" }, 400);
}

function logCorrection(menuItemId: string, name: string, prevType: string, correctType: string | null, action: string | null) {
  try {
    const raw = readFileSync(CORRECTIONS_PATH, "utf-8");
    const data = JSON.parse(raw);
    data.corrections.push({
      menuItemId, name, previousType: prevType,
      ...(correctType ? { correctType } : {}),
      ...(action ? { action } : {}),
      addedBy: "human_audit", date: new Date().toISOString(),
    });
    writeFileSync(CORRECTIONS_PATH, JSON.stringify(data, null, 2) + "\n");
  } catch { /* non-critical */ }
}

function json(res: ServerResponse, data: any, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

function readBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => { try { resolve(JSON.parse(body)); } catch { resolve({}); } });
  });
}

// Serve static dish photos
function servePhoto(path: string, res: ServerResponse) {
  try {
    const filePath = join(__dirname, "../public", path);
    const data = readFileSync(filePath);
    res.writeHead(200, { "Content-Type": "image/jpeg" });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>FoodClaw Audit</title>
<script src="https://cdn.tailwindcss.com"></script>
<script>tailwind.config={darkMode:'class',theme:{extend:{colors:{primary:'#22c55e'}}}}</script>
</head><body class="bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100 min-h-screen">
<div id="app" class="max-w-5xl mx-auto px-4 py-8">
<h1 class="text-2xl font-bold mb-2">FoodClaw Audit</h1>
<div class="flex gap-4 mb-6">
<a href="/" class="px-4 py-2 rounded-lg bg-emerald-100 text-emerald-800 font-medium text-sm hover:bg-emerald-200">Classifier</a>
<a href="/?tab=photos" class="px-4 py-2 rounded-lg bg-blue-100 text-blue-800 font-medium text-sm hover:bg-blue-200">Photos</a>
</div>
<div id="content">Loading...</div>
</div>
<script>
const TYPES = [
  {v:"dish",l:"Dish",c:"bg-emerald-100 text-emerald-800"},
  {v:"dessert",l:"Dessert",c:"bg-pink-100 text-pink-800"},
  {v:"drink",l:"Drink",c:"bg-blue-100 text-blue-800"},
  {v:"alcohol",l:"Alcohol",c:"bg-rose-100 text-rose-800"},
  {v:"side",l:"Side",c:"bg-amber-100 text-amber-800"},
  {v:"condiment",l:"Condiment",c:"bg-orange-100 text-orange-800"},
  {v:"addon",l:"Add-on",c:"bg-purple-100 text-purple-800"},
  {v:"combo",l:"Combo",c:"bg-indigo-100 text-indigo-800"},
  {v:"kids",l:"Kids",c:"bg-yellow-100 text-yellow-800"},
];
let reviewed=0, selected=new Set();

function googleUrl(name,rest){return 'https://www.google.com/search?q='+encodeURIComponent(name+' '+rest+' food dish')+'&tbm=isch'}

async function loadClassifier(page=1,filter='needs-review'){
  const r=await fetch('/api/classifier?page='+page+'&filter='+filter);
  const d=await r.json();
  const items=d.data.items, total=d.data.total;
  selected.clear();
  let h='<div class="flex gap-2 mb-4 text-sm"><span class="font-bold text-emerald-600">'+reviewed+' reviewed</span><span class="text-gray-500">'+total+' remaining</span></div>';
  h+='<div class="flex gap-1 mb-4">';
  ['needs-review','dish-cards','not-dish-cards','all'].forEach(f=>{
    h+='<button onclick="loadClassifier(1,\\''+f+'\\')" class="text-xs px-3 py-1 rounded '+(f===filter?'bg-gray-900 text-white':'bg-gray-200 hover:bg-gray-300')+'">'+f+'</button>';
  });
  h+='</div>';
  // Bulk bar
  h+='<div id="bulk" class="hidden sticky top-0 z-10 bg-white dark:bg-gray-900 border rounded-lg p-2 mb-3 flex gap-1 flex-wrap items-center shadow-lg"><span id="bulkCount" class="text-sm font-bold mr-2"></span>';
  TYPES.forEach(t=>{h+='<button onclick="bulkAction(\\''+t.v+'\\' )" class="text-xs px-2 py-1 rounded border hover:bg-gray-100">'+t.l+'</button>'});
  h+='<button onclick="bulkAction(\\'reject\\')" class="text-xs px-2 py-1 rounded border border-red-300 text-red-600 hover:bg-red-50 ml-2">Reject All</button>';
  h+='<button onclick="selected.clear();updateBulk();renderItems()" class="text-xs text-gray-400 ml-auto">Clear</button></div>';
  h+='<label class="flex items-center gap-2 mb-3 text-sm text-gray-500 cursor-pointer"><input type="checkbox" onchange="toggleAll(this.checked)" '+(selected.size===items.length&&items.length?'checked':'')+'> Select all</label>';
  h+='<div id="items" class="space-y-3">';
  items.forEach(i=>{h+=classifierCard(i)});
  h+='</div>';
  if(total>50){
    h+='<div class="flex justify-center gap-2 mt-6">';
    if(page>1)h+='<button onclick="loadClassifier('+(page-1)+',\\''+filter+'\\')" class="px-3 py-1 text-sm rounded border hover:bg-gray-100">Prev</button>';
    h+='<span class="px-3 py-1 text-sm text-gray-500">Page '+page+'/'+Math.ceil(total/50)+'</span>';
    if(page<Math.ceil(total/50))h+='<button onclick="loadClassifier('+(page+1)+',\\''+filter+'\\')" class="px-3 py-1 text-sm rounded border hover:bg-gray-100">Next</button>';
    h+='</div>';
  }
  document.getElementById('content').innerHTML=h;
  window._items=items; window._page=page; window._filter=filter;
}

function classifierCard(i){
  const badge=TYPES.find(t=>t.v===i.menuItemType)||{l:i.menuItemType,c:'bg-gray-200 text-gray-700'};
  const chk=selected.has(i.id)?'checked':'';
  let h='<div id="item-'+i.id+'" class="border rounded-lg p-3 bg-white dark:bg-gray-900 '+(selected.has(i.id)?'ring-2 ring-emerald-400':'')+'">';
  h+='<div class="flex items-start gap-2 mb-2"><input type="checkbox" '+chk+' onchange="toggleSel(\\''+i.id+'\\')" class="mt-1">';
  h+='<div class="flex-1 min-w-0"><div class="flex items-center gap-2"><b class="truncate">'+i.name+'</b>';
  h+='<a href="'+googleUrl(i.name,i.restaurantName)+'" target="_blank" class="text-xs px-1.5 py-0.5 rounded border text-gray-400 hover:text-gray-700 hover:bg-gray-100 shrink-0">Search</a></div>';
  if(i.description)h+='<p class="text-xs text-gray-500 line-clamp-1">'+i.description+'</p>';
  h+='</div>';
  if(i.price!=null)h+='<span class="text-sm font-medium shrink-0">$'+i.price.toFixed(2)+'</span>';
  h+='<span class="text-xs px-2 py-0.5 rounded-full '+badge.c+' shrink-0">'+badge.l+'</span>';
  if(i.isDishCard)h+='<span class="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">Card</span>';
  h+='</div>';
  h+='<div class="text-xs text-gray-400 mb-2 ml-6">'+i.restaurantName+(i.category?' · '+i.category:'')+(i.auditConfidence!=null?' · '+Math.round(i.auditConfidence*100)+'%':'')+'</div>';
  h+='<div class="flex gap-1 flex-wrap ml-6">';
  TYPES.forEach(t=>{
    const act=i.menuItemType===t.v?'ring-2 ring-emerald-400 '+t.c:'border hover:bg-gray-100';
    h+='<button onclick="classify(\\''+i.id+'\\',\\''+t.v+'\\')" class="text-xs px-2.5 py-1 rounded-lg border '+act+'">'+t.l+'</button>';
  });
  h+='<span class="w-px h-4 bg-gray-200 mx-1 self-center"></span>';
  h+='<button onclick="reject(\\''+i.id+'\\')" class="text-xs px-2.5 py-1 rounded-lg border border-red-300 text-red-500 hover:bg-red-50">Reject</button>';
  h+='</div></div>';
  return h;
}

async function classify(id,type){
  const el=document.getElementById('item-'+id);if(el)el.style.opacity='0.3';
  await fetch('/api/classifier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({menuItemId:id,correctType:type})});
  if(el)el.remove(); reviewed++; loadClassifier(window._page,window._filter);
}
async function reject(id){
  if(!confirm('Remove from menu?'))return;
  const el=document.getElementById('item-'+id);if(el)el.style.opacity='0.3';
  await fetch('/api/classifier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({menuItemId:id,action:'reject'})});
  if(el)el.remove(); reviewed++; loadClassifier(window._page,window._filter);
}
function toggleSel(id){if(selected.has(id))selected.delete(id);else selected.add(id);updateBulk();
  const el=document.getElementById('item-'+id);if(el)el.className=el.className.replace(/ring-2 ring-emerald-400/g,'')+(selected.has(id)?' ring-2 ring-emerald-400':'');
}
function toggleAll(checked){
  window._items.forEach(i=>{if(checked)selected.add(i.id);else selected.delete(i.id)});
  updateBulk(); loadClassifier(window._page,window._filter);
}
function updateBulk(){
  const b=document.getElementById('bulk');const c=document.getElementById('bulkCount');
  if(selected.size>0){b.classList.remove('hidden');c.textContent=selected.size+' selected'}
  else{b.classList.add('hidden')}
}
async function bulkAction(action){
  if(selected.size===0)return;
  if(!confirm((action==='reject'?'Reject':'Classify as '+action)+' '+selected.size+' items?'))return;
  for(const id of selected){
    const body=action==='reject'?{menuItemId:id,action:'reject'}:{menuItemId:id,correctType:action};
    await fetch('/api/classifier',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
    reviewed++;
  }
  selected.clear(); loadClassifier(window._page,window._filter);
}

async function loadPhotos(page=1,filter='unreviewed'){
  const r=await fetch('/api/photos?page='+page+'&filter='+filter+'&limit=50');
  const d=await r.json();
  const items=d.data.items, total=d.data.total;
  let h='<div class="flex gap-2 mb-4 text-sm"><span class="font-bold text-emerald-600">'+reviewed+' reviewed</span><span class="text-gray-500">'+total+' remaining</span></div>';
  h+='<div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">';
  items.forEach(i=>{
    h+='<div id="ph-'+i.photoId+'" class="border rounded-lg overflow-hidden bg-white dark:bg-gray-900">';
    h+='<div class="aspect-square bg-gray-100"><img src="'+i.photoUrl+'" class="w-full h-full object-cover" onerror="this.src=\\'/placeholder-dish.svg\\'"></div>';
    h+='<div class="p-2"><p class="text-xs font-semibold truncate" title="'+i.dishName+'">'+i.dishName+'</p>';
    h+='<p class="text-[10px] text-gray-400 truncate">'+i.restaurantName+'</p>';
    h+='<div class="flex gap-1 mt-1.5">';
    h+='<button onclick="photoAction(\\''+i.photoId+'\\',\\''+i.dishId+'\\',\\'approve\\')" class="flex-1 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-700 hover:bg-emerald-200">OK</button>';
    h+='<button onclick="photoAction(\\''+i.photoId+'\\',\\''+i.dishId+'\\',\\'reject\\')" class="flex-1 py-0.5 text-[10px] font-bold rounded bg-red-100 text-red-700 hover:bg-red-200">Bad</button>';
    h+='<a href="'+googleUrl(i.dishName,i.cuisine)+'" target="_blank" class="flex-1 py-0.5 text-[10px] font-bold rounded bg-blue-100 text-blue-700 hover:bg-blue-200 text-center">Google</a>';
    h+='</div><div class="flex gap-1 mt-1">';
    h+='<button onclick="photoAction(\\''+i.photoId+'\\',\\''+i.dishId+'\\',\\'remove-all\\')" class="flex-1 py-0.5 text-[10px] rounded bg-red-50 text-red-500 hover:bg-red-100">Remove All</button>';
    h+='</div></div></div>';
  });
  h+='</div>';
  if(total>50){
    h+='<div class="flex justify-center gap-2 mt-6">';
    if(page>1)h+='<button onclick="loadPhotos('+(page-1)+',\\''+filter+'\\')" class="px-3 py-1 text-sm rounded border">Prev</button>';
    h+='<span class="px-3 py-1 text-sm text-gray-500">Page '+page+'/'+Math.ceil(total/50)+'</span>';
    if(page<Math.ceil(total/50))h+='<button onclick="loadPhotos('+(page+1)+',\\''+filter+'\\')" class="px-3 py-1 text-sm rounded border">Next</button>';
    h+='</div>';
  }
  document.getElementById('content').innerHTML=h;
  window._photoPage=page;window._photoFilter=filter;
}

async function photoAction(photoId,dishId,action){
  if(action==='remove-all'&&!confirm('Remove from menu entirely?'))return;
  const el=document.getElementById('ph-'+photoId);if(el)el.style.opacity='0.3';
  await fetch('/api/photos',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({photoId,dishId,action})});
  if(el)el.remove(); reviewed++;
}

// Route
const tab=new URLSearchParams(location.search).get('tab');
if(tab==='photos')loadPhotos(); else loadClassifier();
</script></body></html>`;

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://localhost:${PORT}`);

  // CORS
  if (req.method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET,POST", "Access-Control-Allow-Headers": "Content-Type" });
    res.end();
    return;
  }

  try {
    // Static photos
    if (url.pathname.startsWith("/dishes/")) {
      return servePhoto(url.pathname, res);
    }

    // API routes
    if (url.pathname === "/api/classifier" && req.method === "GET") return await handleClassifierGet(url, res);
    if (url.pathname === "/api/classifier" && req.method === "POST") return await handleClassifierPost(await readBody(req), res);
    if (url.pathname === "/api/photos" && req.method === "GET") return await handlePhotosGet(url, res);
    if (url.pathname === "/api/photos" && req.method === "POST") return await handlePhotosPost(await readBody(req), res);

    // Serve HTML
    if (url.pathname === "/" || url.pathname === "/classifier" || url.pathname === "/photos") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(HTML);
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (err) {
    console.error("Error:", err);
    json(res, { error: String(err) }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`\nFoodClaw Audit Server running at http://localhost:${PORT}`);
  console.log(`  Classifier: http://localhost:${PORT}/`);
  console.log(`  Photos:     http://localhost:${PORT}/?tab=photos\n`);
});
