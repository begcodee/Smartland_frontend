import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Camera, Upload, Image as ImageIcon, Trash2, 
  MapPin, Eye, Plus, CheckCircle 
} from 'lucide-react';
import { toast } from '@/lib/appToast';

interface LandImageUploadProps {
  onImagesUploaded: (images: LandImage[]) => void;
  maxImages?: number;
}

interface LandImage {
  id: string;
  url: string;
  caption: string;
  type: 'aerial' | 'boundary' | 'structure' | 'access' | 'general';
  uploadedAt: string;
  size: number;
}

export const LandImageUpload = ({ onImagesUploaded, maxImages = 10 }: LandImageUploadProps) => {
  const [images, setImages] = useState<LandImage[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const imageTypes = [
    { value: 'aerial', label: 'Aerial View', icon: <Camera className="w-4 h-4" /> },
    { value: 'boundary', label: 'Boundary Markers', icon: <MapPin className="w-4 h-4" /> },
    { value: 'structure', label: 'Structures', icon: <ImageIcon className="w-4 h-4" /> },
    { value: 'access', label: 'Road Access', icon: <Eye className="w-4 h-4" /> },
    { value: 'general', label: 'General View', icon: <Plus className="w-4 h-4" /> }
  ];

  const handleFileUpload = async (files: FileList | null, type: string) => {
    if (!files || files.length === 0) return;

    if (images.length + files.length > maxImages) {
      toast.error(`Maximum ${maxImages} images allowed`);
      return;
    }

    setIsUploading(true);

    try {
      const newImages: LandImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        
        // Validate file type
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not a valid image file`);
          continue;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name} is too large. Maximum size is 5MB`);
          continue;
        }

        // Convert to base64
        const reader = new FileReader();
        const imageData = await new Promise<string>((resolve) => {
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });

        const newImage: LandImage = {
          id: `IMG_${Date.now()}_${i}`,
          url: imageData,
          caption: `${type.charAt(0).toUpperCase() + type.slice(1)} - ${file.name}`,
          type: type as LandImage['type'],
          uploadedAt: new Date().toISOString(),
          size: file.size
        };

        newImages.push(newImage);
      }

      const updatedImages = [...images, ...newImages];
      setImages(updatedImages);
      onImagesUploaded(updatedImages);
      
      toast.success(`${newImages.length} image(s) uploaded successfully!`);
      
    } catch (error) {
      toast.error('Failed to upload images. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const removeImage = (imageId: string) => {
    const updatedImages = images.filter(img => img.id !== imageId);
    setImages(updatedImages);
    onImagesUploaded(updatedImages);
    toast.success('Image removed successfully');
  };

  const updateCaption = (imageId: string, newCaption: string) => {
    const updatedImages = images.map(img => 
      img.id === imageId ? { ...img, caption: newCaption } : img
    );
    setImages(updatedImages);
    onImagesUploaded(updatedImages);
  };

  const getTypeIcon = (type: string) => {
    const typeConfig = imageTypes.find(t => t.value === type);
    return typeConfig?.icon || <ImageIcon className="w-4 h-4" />;
  };

  const getTypeLabel = (type: string) => {
    const typeConfig = imageTypes.find(t => t.value === type);
    return typeConfig?.label || 'General';
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="w-5 h-5" />
          Land Property Images
        </CardTitle>
        <CardDescription>
          Upload photos of your land property. Include aerial views, boundaries, structures, and access roads.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Section */}
        <div className="space-y-4">
          <Alert>
            <ImageIcon className="h-4 w-4" />
            <AlertDescription>
              Upload clear, high-quality images of your land. Accepted formats: JPG, PNG, WebP. 
              Maximum size: 5MB per image. Maximum {maxImages} images total.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {imageTypes.map((type) => (
              <div key={type.value} className="space-y-2">
                <Label className="flex items-center gap-2">
                  {type.icon}
                  {type.label}
                </Label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-blue-400 transition-colors">
                  <div className="space-y-2">
                    <Upload className="w-6 h-6 mx-auto text-gray-400" />
                    <p className="text-sm text-gray-500">Click to upload</p>
                  </div>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => handleFileUpload(e.target.files, type.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                </div>
              </div>
            ))}
          </div>

          {isUploading && (
            <div className="text-center py-4">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-gray-600">Uploading images...</p>
            </div>
          )}
        </div>

        {/* Images Grid */}
        {images.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Uploaded Images ({images.length}/{maxImages})</h3>
              <Badge variant="outline">
                Total: {formatFileSize(images.reduce((sum, img) => sum + img.size, 0))}
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {images.map((image) => (
                <Card key={image.id} className="overflow-hidden">
                  <div className="relative">
                    <img 
                      src={image.url} 
                      alt={image.caption}
                      className="w-full h-48 object-cover"
                    />
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {getTypeIcon(image.type)}
                        <span className="ml-1">{getTypeLabel(image.type)}</span>
                      </Badge>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => removeImage(image.id)}
                        className="h-6 w-6 p-0"
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  <CardContent className="p-3 space-y-2">
                    <Input
                      value={image.caption}
                      onChange={(e) => updateCaption(image.id, e.target.value)}
                      placeholder="Add a caption..."
                      className="text-sm"
                    />
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>{formatFileSize(image.size)}</span>
                      <span>{new Date(image.uploadedAt).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Guidelines */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Image Guidelines:</h4>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>Aerial View:</strong> Drone or satellite images showing the entire property</li>
            <li>• <strong>Boundary Markers:</strong> Photos of boundary stones, fences, or markers</li>
            <li>• <strong>Structures:</strong> Any buildings, wells, or permanent structures on the land</li>
            <li>• <strong>Road Access:</strong> Photos showing how to access the property</li>
            <li>• <strong>General View:</strong> Overall landscape and terrain photos</li>
          </ul>
        </div>

        {images.length > 0 && (
          <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <span className="text-green-800 font-medium">
              {images.length} image(s) ready for land registration
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};