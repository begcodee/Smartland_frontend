import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, X, Image as ImageIcon, Camera, Plus } from 'lucide-react';
import { toast } from '@/lib/appToast';

interface UploadedImage {
  id: string;
  file: File;
  url: string;
  caption: string;
  type: 'main' | 'aerial' | 'boundary' | 'interior' | 'exterior';
}

interface ImageUploadProps {
  onImagesChange: (images: UploadedImage[]) => void;
  maxImages?: number;
  existingImages?: UploadedImage[];
}

export const ImageUpload = ({ onImagesChange, maxImages = 8, existingImages = [] }: ImageUploadProps) => {
  const [images, setImages] = useState<UploadedImage[]>(existingImages);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList) => {
    const newImages: UploadedImage[] = [];
    
    Array.from(files).forEach((file) => {
      if (file.type.startsWith('image/')) {
        if (images.length + newImages.length < maxImages) {
          const id = `img_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          const url = URL.createObjectURL(file);
          
          newImages.push({
            id,
            file,
            url,
            caption: '',
            type: 'main'
          });
        }
      }
    });

    if (newImages.length > 0) {
      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);
      onImagesChange(updatedImages);
      toast.success(`Added ${newImages.length} image(s)`);
    }

    if (images.length + newImages.length >= maxImages) {
      toast.warning(`Maximum ${maxImages} images allowed`);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFiles(e.target.files);
    }
  };

  const removeImage = (id: string) => {
    const updatedImages = images.filter(img => img.id !== id);
    setImages(updatedImages);
    onImagesChange(updatedImages);
    toast.success('Image removed');
  };

  const updateImageCaption = (id: string, caption: string) => {
    const updatedImages = images.map(img => 
      img.id === id ? { ...img, caption } : img
    );
    setImages(updatedImages);
    onImagesChange(updatedImages);
  };

  const updateImageType = (id: string, type: UploadedImage['type']) => {
    const updatedImages = images.map(img => 
      img.id === id ? { ...img, type } : img
    );
    setImages(updatedImages);
    onImagesChange(updatedImages);
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ${
          dragActive 
            ? 'border-cyan-500 bg-cyan-50 scale-105' 
            : 'border-slate-300 hover:border-cyan-400 hover:bg-slate-50'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-cyan-100 to-blue-100 rounded-full flex items-center justify-center">
            <Camera className="w-6 h-6 text-cyan-600" />
          </div>
          <div>
            <p className="text-lg font-medium text-slate-700">
              Drop images here or click to upload
            </p>
            <p className="text-sm text-slate-500 mt-1">
              PNG, JPG, JPEG up to 10MB each • Max {maxImages} images
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            className="border-cyan-300 text-cyan-700 hover:bg-cyan-50"
          >
            <Upload className="w-4 h-4 mr-2" />
            Choose Files
          </Button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*"
          onChange={handleFileInput}
          className="hidden"
        />
      </div>

      {/* Image Preview Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {images.map((image) => (
            <Card key={image.id} className="overflow-hidden border-cyan-200/50">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {/* Image Preview */}
                  <div className="relative aspect-video bg-slate-100 rounded-lg overflow-hidden">
                    <img
                      src={image.url}
                      alt={image.caption || 'Property image'}
                      className="w-full h-full object-cover"
                    />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      onClick={() => removeImage(image.id)}
                      className="absolute top-2 right-2 w-6 h-6 p-0 bg-red-500/80 hover:bg-red-600"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                    <Badge 
                      className="absolute bottom-2 left-2 bg-cyan-500/80 text-white"
                    >
                      {image.type}
                    </Badge>
                  </div>

                  {/* Image Details */}
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor={`caption-${image.id}`} className="text-sm font-medium">
                        Caption
                      </Label>
                      <Input
                        id={`caption-${image.id}`}
                        placeholder="Describe this image..."
                        value={image.caption}
                        onChange={(e) => updateImageCaption(image.id, e.target.value)}
                        className="text-sm border-slate-300 focus:border-cyan-500"
                      />
                    </div>

                    <div>
                      <Label htmlFor={`type-${image.id}`} className="text-sm font-medium">
                        Image Type
                      </Label>
                      <select
                        id={`type-${image.id}`}
                        value={image.type}
                        onChange={(e) => updateImageType(image.id, e.target.value as UploadedImage['type'])}
                        className="w-full p-2 text-sm border border-slate-300 rounded-md focus:border-cyan-500 focus:outline-none"
                      >
                        <option value="main">Main Photo</option>
                        <option value="aerial">Aerial View</option>
                        <option value="boundary">Boundary/Survey</option>
                        <option value="interior">Interior</option>
                        <option value="exterior">Exterior</option>
                      </select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Summary */}
      {images.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
          <div className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-slate-600" />
            <span className="text-sm text-slate-600">
              {images.length} of {maxImages} images uploaded
            </span>
          </div>
          <Badge variant="outline" className="border-cyan-300 text-cyan-700">
            {((images.reduce((acc, img) => acc + img.file.size, 0)) / 1024 / 1024).toFixed(1)} MB
          </Badge>
        </div>
      )}
    </div>
  );
};