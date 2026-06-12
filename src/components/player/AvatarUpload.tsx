"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Check, X } from "lucide-react";

type Props = {
  currentUrl: string | null;
  username: string;
};

export function AvatarUpload({ currentUrl, username }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Preview
    setPreview(URL.createObjectURL(file));
    setUploading(true);
    setSuccess(false);

    const form = new FormData();
    form.append("avatar", file);

    const res = await fetch("/api/upload/avatar", {
      method: "POST",
      body: form,
    });

    setUploading(false);
    if (res.ok) {
      setSuccess(true);
      router.refresh();
      setTimeout(() => setSuccess(false), 2000);
    }
  };

  return (
    <div className="relative inline-block">
      {/* Avatar */}
      <div
        className="w-16 h-16 rounded-full overflow-hidden bg-gold/10 flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity border-2 border-border hover:border-gold/50"
        onClick={() => inputRef.current?.click()}
      >
        {preview ? (
          <img src={preview} alt="" className="w-full h-full object-cover" />
        ) : currentUrl ? (
          <img src={currentUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-gold text-xl font-bold">{username[0].toUpperCase()}</span>
        )}

        {/* Upload overlay */}
        <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
          {uploading ? (
            <Loader2 className="w-5 h-5 text-white animate-spin" />
          ) : success ? (
            <Check className="w-5 h-5 text-green-400" />
          ) : (
            <Camera className="w-5 h-5 text-white" />
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={handleFile}
        className="hidden"
      />
    </div>
  );
}
