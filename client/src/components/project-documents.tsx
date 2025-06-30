import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { FileText, Upload, Download, Trash2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useAuth } from "@/hooks/use-auth";

interface ProjectDocument {
  id: number;
  projectId: number;
  uploaderId: number;
  fileName: string;
  filePath: string;
  fileSize: number;
  documentType: string;
  description: string | null;
  uploadDate: string;
  isDeleted: boolean;
}

interface ProjectDocumentsProps {
  projectId: number;
  isProjectManager: boolean;
}

export default function ProjectDocuments({ projectId, isProjectManager }: ProjectDocumentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploadOpen, setUploadOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("");
  const [description, setDescription] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");

  // Query to fetch project documents
  const {
    data: documents,
    isLoading,
    error: queryError,
  } = useQuery<ProjectDocument[]>({
    queryKey: ["/api/projects", projectId, "documents"],
    queryFn: async () => {
      const response = await fetch(`/api/projects/${projectId}/documents`);
      if (!response.ok) {
        throw new Error("Failed to fetch project documents");
      }
      return response.json();
    },
  });

  // Mutation to upload a document
  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const response = await fetch(`/api/projects/${projectId}/documents`, {
        method: "POST",
        body: formData,
        // No need to set Content-Type as it will be set automatically with boundary
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to upload document");
      }

      return response.json();
    },
    onSuccess: () => {
      // Clear form
      setFile(null);
      setDocumentType("");
      setDescription("");
      setError("");
      setUploadOpen(false);
      
      // Show success toast
      toast({
        title: "Document uploaded",
        description: "The document was successfully uploaded.",
        variant: "default",
      });
      
      // Invalidate documents query to refresh the list
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "documents"] });
    },
    onError: (error: Error) => {
      setError(error.message);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation to delete a document (mark as deleted)
  const deleteMutation = useMutation({
    mutationFn: async (documentId: number) => {
      const response = await apiRequest("DELETE", `/api/projects/${projectId}/documents/${documentId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || errorData.error || "Failed to delete document");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Document deleted",
        description: "The document was successfully deleted.",
        variant: "default",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", projectId, "documents"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const selectedFile = e.target.files[0];
      
      // Check if file is a PDF
      if (selectedFile.type !== "application/pdf") {
        setError("Only PDF files are allowed");
        setFile(null);
        return;
      }
      
      // Check file size (5MB limit)
      if (selectedFile.size > 5 * 1024 * 1024) {
        setError("File size exceeds the 5MB limit");
        setFile(null);
        return;
      }
      
      setFile(selectedFile);
      setError("");
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file to upload");
      return;
    }

    if (!documentType) {
      setError("Please select a document type");
      return;
    }

    setIsUploading(true);
    setError("");

    // Create form data
    const formData = new FormData();
    formData.append("document", file);
    formData.append("documentType", documentType);
    if (description) {
      formData.append("description", description);
    }

    try {
      await uploadMutation.mutateAsync(formData);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = (document: ProjectDocument) => {
    window.open(`/api/documents/${document.id}/download`, "_blank");
  };

  const handleDelete = (documentId: number) => {
    if (confirm("Are you sure you want to delete this document?")) {
      deleteMutation.mutate(documentId);
    }
  };

  // Format file size from bytes to KB or MB
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) {
      return bytes + " B";
    } else if (bytes < 1024 * 1024) {
      return (bytes / 1024).toFixed(1) + " KB";
    } else {
      return (bytes / (1024 * 1024)).toFixed(1) + " MB";
    }
  };

  // Format date string
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <div>
            <CardTitle>Project Documents</CardTitle>
            <CardDescription>Supporting documentation for this project</CardDescription>
          </div>
          {/* Only show upload button for project managers */}
          {isProjectManager && (
            <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Document
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Upload Project Document</DialogTitle>
                  <DialogDescription>
                    Upload a PDF document to attach to this project. Maximum file size is 5MB.
                  </DialogDescription>
                </DialogHeader>
                
                {error && (
                  <Alert variant="destructive" className="my-2">
                    <AlertCircle className="h-4 w-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}
                
                <div className="space-y-4 py-2">
                  <div className="grid w-full gap-1.5">
                    <Label htmlFor="document">Document (PDF)</Label>
                    <Input
                      id="document"
                      type="file"
                      accept="application/pdf"
                      onChange={handleFileChange}
                    />
                    {file && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Selected: {file.name} ({formatFileSize(file.size)})
                      </p>
                    )}
                  </div>
                  
                  <div className="grid w-full gap-1.5">
                    <Label htmlFor="documentType">Document Type</Label>
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger id="documentType">
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="contract">Contract</SelectItem>
                        <SelectItem value="report">Report</SelectItem>
                        <SelectItem value="specification">Specification</SelectItem>
                        <SelectItem value="proposal">Proposal</SelectItem>
                        <SelectItem value="invoice">Invoice</SelectItem>
                        <SelectItem value="other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid w-full gap-1.5">
                    <Label htmlFor="description">Description (Optional)</Label>
                    <Textarea
                      id="description"
                      placeholder="Enter a description for this document"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                </div>
                
                <DialogFooter>
                  <Button variant="outline" onClick={() => setUploadOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpload} disabled={isUploading}>
                    {isUploading ? (
                      <>Uploading...</>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        Upload
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-6 text-center text-muted-foreground">Loading documents...</div>
        ) : queryError ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>Failed to load project documents. Please try again.</AlertDescription>
          </Alert>
        ) : documents && documents.length > 0 ? (
          <div className="space-y-4">
            {documents.map((document) => (
              <div
                key={document.id}
                className="flex items-start justify-between p-4 border rounded-md hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-start space-x-4">
                  <div className="bg-primary/10 p-2 rounded">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">{document.fileName}</div>
                    <div className="text-sm text-muted-foreground mb-1">
                      {formatDate(document.uploadDate)} • {formatFileSize(document.fileSize)}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">{document.documentType}</Badge>
                      {document.description && (
                        <span className="text-sm text-muted-foreground">
                          {document.description}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDownload(document)}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  {isProjectManager && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground"
                      onClick={() => handleDelete(document.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-10 text-center border rounded-md border-dashed">
            <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <h3 className="text-lg font-medium">No documents yet</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isProjectManager
                ? "Upload documents to keep track of project assets."
                : "This project doesn't have any documents yet."}
            </p>
            {isProjectManager && (
              <Button 
                variant="outline" 
                className="mt-4"
                onClick={() => setUploadOpen(true)}
              >
                <Upload className="mr-2 h-4 w-4" />
                Upload First Document
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}