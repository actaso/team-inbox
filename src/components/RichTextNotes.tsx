"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { storage } from "@/lib/firebase";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";

type Props = {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  className?: string;
  onCmdEnter?: () => void;
};

export default function RichTextNotes({ value, onChange, placeholder, className, onCmdEnter }: Props) {
  const lastHtmlRef = useRef<string>(value || "");
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const emitChangeDebounced = useCallback((html: string) => {
    if (!onChange) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      lastHtmlRef.current = html;
      onChange(html);
    }, 250);
  }, [onChange]);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3, 4] },
      }),
      Image.configure({
        inline: false,
        HTMLAttributes: {
          class: 'rte-image',
        },
      }),
    ],
    content: value || "",
    // Avoid rendering on the server to prevent hydration mismatches
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none",
          "min-h-32 px-3 py-2 rounded-md border bg-background",
          className
        ),
      },
      handlePaste(view, event) {
        const files = Array.from(event.clipboardData?.files || []);
        if (files.length > 0) {
          void handleFiles(files);
          return true;
        }
        return false;
      },
      handleDrop(view, event) {
        const files = Array.from(event.dataTransfer?.files || []);
        if (files.length > 0) {
          event.preventDefault();
          void handleFiles(files);
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      if (html === lastHtmlRef.current) return;
      emitChangeDebounced(html);
    },
  });
  // Sync external value into editor only if it differs from current content
  useEffect(() => {
    if (!editor) return;
    const current = editor.getHTML();
    const next = value || "";
    if (current !== next) {
      editor.commands.setContent(next, false);
      lastHtmlRef.current = next;
    }
  }, [editor, value]);


  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    for (const file of imageFiles) {
      const storagePath = `notes/${Date.now()}-${file.name}`;
      const storageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(snapshot.ref);
      editor?.chain().focus().setImage({ src: url, alt: file.name }).run();
    }
  }, [editor]);

  const placeholderStyle = useMemo(() => ({
    position: 'relative' as const,
  }), []);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          Upload image
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = e.target.files ? Array.from(e.target.files) : [];
            void handleFiles(files);
          }}
        />
      </div>
      <div style={placeholderStyle}>
        {editor && editor.isEmpty && (value ?? "").replace(/<[^>]+>/g, '').trim().length === 0 && (
          <div className="pointer-events-none absolute left-3 top-2 text-muted-foreground text-sm">
            {placeholder || "Notes (rich text, paste or drag & drop images)"}
          </div>
        )}
        <EditorContent
          editor={editor}
          onKeyDown={(e) => {
            // Prevent Enter from bubbling to global shortcuts when editing rich text
            e.stopPropagation();
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'enter') {
              e.preventDefault();
              // Ensure latest content is sent before committing
              if (editor) {
                const html = editor.getHTML();
                if (html !== lastHtmlRef.current) {
                  lastHtmlRef.current = html;
                  onChange?.(html);
                }
              }
              onCmdEnter?.();
            }
          }}
          onKeyUp={(e) => e.stopPropagation()}
          onKeyPress={(e) => e.stopPropagation()}
        />
      </div>

      {/* Scoped styles for image attachments */}
      <style jsx global>{`
        .prose img.rte-image {
          display: block;
          max-width: 100%;
          height: auto;
          max-height: 200px;
          object-fit: contain;
          border: 1px solid hsl(var(--border));
          border-radius: 0.375rem; /* rounded-md */
          padding: 0.25rem; /* p-1 */
          background: hsl(var(--muted));
        }
      `}</style>
    </div>
  );
}


