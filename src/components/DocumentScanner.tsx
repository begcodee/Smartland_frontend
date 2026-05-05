import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  FileText, Scan, Upload, CheckCircle, 
  AlertTriangle, Camera, File, Trash2 
} from 'lucide-react';
import { toast } from '@/lib/appToast';

interface DocumentScannerProps {
  onDocumentsScanned: (documents: ScannedDocument[]) => void;
  requiredDocuments: string[];
  title?: string;
}

export interface ScannedDocument {
  id: string;
  name: string;
  type: string;
  scannedImage: string;
  uploadedAt: string;
  size: number;
}

export const DocumentScanner = ({ onDocumentsScanned, requiredDocuments, title = "Document Scanner" }: DocumentScannerProps) => {
  const [scannedDocs, setScannedDocs] = useState<ScannedDocument[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [currentDocType, setCurrentDocType] = useState<string>('');

  const handleFileUpload = (file: File, docType: string) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      
      const newDoc: ScannedDocument = {
        id: `DOC_${Date.now()}`,
        name: docType,
        type: file.type,
        scannedImage: result,
        uploadedAt: new Date().toISOString(),
        size: file.size
      };

      const updatedDocs = [...scannedDocs.filter(doc => doc.name !== docType), newDoc];
      setScannedDocs(updatedDocs);
      onDocumentsScanned(updatedDocs);

      toast.success(`${docType} scanned successfully!`);
    };
    reader.readAsDataURL(file);
  };

  const simulateDocumentScan = (docType: string) => {
    setIsScanning(true);
    setCurrentDocType(docType);

    // Simulate scanning process
    setTimeout(() => {
      const mockScannedDoc: ScannedDocument = {
        id: `DOC_${Date.now()}`,
        name: docType,
        type: 'application/pdf',
        scannedImage: 'data:application/pdf;base64,JVBERi0xLjQKJcOkw7zDtsO8CjIgMCBvYmoKPDwvTGVuZ3RoIDMgMCBSL0ZpbHRlci9GbGF0ZURlY29kZT4+',
        uploadedAt: new Date().toISOString(),
        size: 1024 * 50 // 50KB mock size
      };

      const updatedDocs = [...scannedDocs.filter(doc => doc.name !== docType), mockScannedDoc];
      setScannedDocs(updatedDocs);
      onDocumentsScanned(updatedDocs);
      
      setIsScanning(false);
      setCurrentDocType('');
      toast.success(`${docType} scanned successfully!`);
    }, 2000);
  };

  const removeDocument = (docId: string) => {
    const updatedDocs = scannedDocs.filter(doc => doc.id !== docId);
    setScannedDocs(updatedDocs);
    onDocumentsScanned(updatedDocs);
    toast.success('Document removed');
  };

  const isDocumentScanned = (docType: string) => {
    return scannedDocs.some(doc => doc.name === docType);
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="w-5 h-5" />
          {title}
        </CardTitle>
        <CardDescription>
          Scan or upload required documents for land registration
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Required Documents List */}
        <div className="space-y-4">
          <h3 className="text-sm font-medium">Required Documents</h3>
          <div className="grid gap-3">
            {requiredDocuments.map((docType, index) => (
              <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {isDocumentScanned(docType) ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <File className="w-4 h-4 text-gray-400" />
                    )}
                    <span className="text-sm font-medium">{docType}</span>
                  </div>
                  {isDocumentScanned(docType) && (
                    <Badge variant="outline" className="text-green-700 border-green-300">
                      Scanned
                    </Badge>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {isDocumentScanned(docType) ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const doc = scannedDocs.find(d => d.name === docType);
                        if (doc) removeDocument(doc.id);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  ) : (
                    <>
                      {/* File Upload */}
                      <div className="relative">
                        <Input
                          type="file"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, docType);
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <Button variant="outline" size="sm">
                          <Upload className="w-4 h-4 mr-2" />
                          Upload
                        </Button>
                      </div>
                      
                      {/* Simulate Scan */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => simulateDocumentScan(docType)}
                        disabled={isScanning && currentDocType === docType}
                      >
                        {isScanning && currentDocType === docType ? (
                          <>
                            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2" />
                            Scanning...
                          </>
                        ) : (
                          <>
                            <Scan className="w-4 h-4 mr-2" />
                            Scan
                          </>
                        )}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scanned Documents Summary */}
        {scannedDocs.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Scanned Documents ({scannedDocs.length})</h3>
            <div className="space-y-2">
              {scannedDocs.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-2 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-600" />
                    <span className="text-sm font-medium">{doc.name}</span>
                    <Badge variant="outline" className="text-xs">
                      {(doc.size / 1024).toFixed(1)} KB
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDocument(doc.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Status Alert */}
        <Alert>
          {scannedDocs.length === requiredDocuments.length ? (
            <>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                All required documents have been scanned successfully. You can proceed with land registration.
              </AlertDescription>
            </>
          ) : (
            <>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                {requiredDocuments.length - scannedDocs.length} document(s) remaining to complete the scanning process.
              </AlertDescription>
            </>
          )}
        </Alert>

        {/* Instructions */}
        <div className="text-xs text-gray-500 space-y-1">
          <p><strong>Supported formats:</strong> PDF, JPG, PNG</p>
          <p><strong>Max file size:</strong> 10MB per document</p>
          <p><strong>Quality:</strong> Ensure documents are clear and readable</p>
        </div>
      </CardContent>
    </Card>
  );
};