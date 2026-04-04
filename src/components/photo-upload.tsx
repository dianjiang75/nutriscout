"use client";

import { useRef, useState, useCallback } from "react";
import Image from "next/image";
import { Camera, Upload, X } from "lucide-react";

interface PhotoUploadProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export function PhotoUpload({ onFileSelected, disabled }: PhotoUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      setPreview(URL.createObjectURL(file));
      onFileSelected(file);
    },
    [onFileSelected]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const clearPreview = () => {
    setPreview(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  if (preview) {
    return (
      <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden border border-border/40 shadow-sm">
        <Image src={preview} alt="Food photo preview" fill sizes="100vw" className="object-cover" unoptimized />
        <button
          onClick={clearPreview}
          disabled={disabled}
          className="absolute top-3 right-3 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
          aria-label="Remove photo"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`w-full aspect-[4/3] rounded-2xl border-2 border-dashed transition-all duration-200 flex flex-col items-center justify-center gap-4 ${
        dragOver
          ? "border-primary bg-primary/5 scale-[1.01]"
          : "border-border/40 bg-card hover:border-primary/40 hover:bg-primary/5"
      }`}
    >
      <div className="flex gap-3">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm shadow-sm hover:brightness-110 active:scale-95 transition-all min-h-[44px]"
        >
          <Camera className="w-5 h-5" />
          Take Photo
        </button>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-card border border-border/40 font-medium text-sm shadow-sm hover:bg-accent active:scale-95 transition-all min-h-[44px]"
        >
          <Upload className="w-5 h-5" />
          Upload
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        or drag and drop an image here
      </p>

      {/* Hidden file input — capture="environment" opens rear camera on mobile */}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        onChange={handleInputChange}
        className="hidden"
        aria-label="Select food photo"
      />
    </div>
  );
}
