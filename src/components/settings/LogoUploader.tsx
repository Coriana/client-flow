import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, X, Loader2 } from 'lucide-react';

interface LogoUploaderProps {
  label: string;
  description: string;
  currentUrl: string | null;
  onUpload: (url: string | null) => void;
  bucket?: string;
  folder?: string;
  maxSize?: number;
  accept?: string;
  previewSize?: 'sm' | 'md' | 'lg';
}

export default function LogoUploader({
  label,
  description,
  currentUrl,
  onUpload,
  bucket = 'images',
  folder = 'branding',
  maxSize = 2 * 1024 * 1024, // 2MB
  accept = 'image/png,image/jpeg,image/svg+xml,image/x-icon',
  previewSize = 'md',
}: LogoUploaderProps) {
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const previewSizes = {
    sm: 'h-8 w-8',
    md: 'h-16 w-32',
    lg: 'h-24 w-48',
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: `Maximum file size is ${maxSize / 1024 / 1024}MB`,
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${folder}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      onUpload(publicUrl);
      toast({ title: 'Uploaded successfully' });
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: 'Upload failed',
        description: 'Could not upload file. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemove = () => {
    onUpload(null);
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div className="flex items-center gap-4">
        {currentUrl ? (
          <div className={`${previewSizes[previewSize]} bg-muted rounded-md flex items-center justify-center overflow-hidden border`}>
            <img
              src={currentUrl}
              alt={label}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : (
          <div className={`${previewSizes[previewSize]} bg-muted rounded-md flex items-center justify-center border border-dashed`}>
            <Upload className="h-6 w-6 text-muted-foreground" />
          </div>
        )}

        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            onClick={() => fileInputRef.current?.click()}
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </Button>
          {currentUrl && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleRemove}
            >
              <X className="h-4 w-4 mr-2" />
              Remove
            </Button>
          )}
        </div>
      </div>

      <Input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
