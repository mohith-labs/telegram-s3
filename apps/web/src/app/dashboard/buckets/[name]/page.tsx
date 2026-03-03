"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { useDropzone } from "react-dropzone";
import {
  ArrowLeft,
  ChevronRight,
  Download,
  File,
  Folder,
  Loader2,
  Trash2,
  Upload,
  UploadCloud,
} from "lucide-react";

export default function BucketDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const bucketName = params.name as string;
  const prefix = searchParams.get("prefix") || "";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<
    { name: string; progress: number }[]
  >([]);

  useEffect(() => {
    loadObjects();
  }, [bucketName, prefix]);

  const loadObjects = async () => {
    setLoading(true);
    try {
      const result = await api.listObjects(bucketName, prefix);
      setData(result);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const onDrop = useCallback(
    async (files: File[]) => {
      setUploading(true);
      setUploadProgress(files.map((f) => ({ name: f.name, progress: 0 })));

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const key = prefix + file.name;

        try {
          setUploadProgress((prev) =>
            prev.map((p, idx) => (idx === i ? { ...p, progress: 50 } : p)),
          );

          await api.uploadObject(bucketName, key, file);

          setUploadProgress((prev) =>
            prev.map((p, idx) => (idx === i ? { ...p, progress: 100 } : p)),
          );
        } catch (error: any) {
          toast.error(`Failed to upload ${file.name}: ${error.message}`);
        }
      }

      setUploading(false);
      setUploadProgress([]);
      loadObjects();
      toast.success(
        `${files.length} file${files.length > 1 ? "s" : ""} uploaded`,
      );
    },
    [bucketName, prefix],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
  });

  const handleDelete = async (key: string) => {
    if (!confirm(`Delete "${key}"?`)) return;
    try {
      await api.deleteObject(bucketName, key);
      loadObjects();
      toast.success("Object deleted");
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const navigateToPrefix = (newPrefix: string) => {
    router.push(
      `/dashboard/buckets/${bucketName}?prefix=${encodeURIComponent(newPrefix)}`,
    );
  };

  // Build breadcrumbs from prefix
  const breadcrumbs = prefix
    ? prefix
        .split("/")
        .filter(Boolean)
        .map((part, i, arr) => ({
          label: part,
          prefix: arr.slice(0, i + 1).join("/") + "/",
        }))
    : [];

  return (
    <div className="space-y-6" {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/dashboard/buckets")}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{bucketName}</h1>
          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
            <button
              className="hover:text-foreground transition-colors"
              onClick={() => navigateToPrefix("")}
            >
              Root
            </button>
            {breadcrumbs.map((crumb) => (
              <div key={crumb.prefix} className="flex items-center gap-1">
                <ChevronRight className="h-3 w-3" />
                <button
                  className="hover:text-foreground transition-colors"
                  onClick={() => navigateToPrefix(crumb.prefix)}
                >
                  {crumb.label}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Upload Zone */}
      <div
        className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          isDragActive
            ? "border-primary bg-primary/5"
            : "border-muted hover:border-muted-foreground/30"
        }`}
      >
        <UploadCloud
          className={`mx-auto h-8 w-8 mb-2 ${isDragActive ? "text-primary" : "text-muted-foreground"}`}
        />
        <p className="text-sm text-muted-foreground">
          Drag and drop files here, or{" "}
          <label className="text-primary cursor-pointer hover:underline">
            browse
            <input
              type="file"
              className="hidden"
              multiple
              onChange={(e) => {
                if (e.target.files) onDrop(Array.from(e.target.files));
              }}
            />
          </label>
        </p>
      </div>

      {/* Upload Progress */}
      {uploadProgress.length > 0 && (
        <Card>
          <CardContent className="p-4 space-y-3">
            {uploadProgress.map((item, i) => (
              <div key={i} className="flex items-center gap-3">
                <Upload className="h-4 w-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{item.name}</p>
                  <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {item.progress}%
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Objects Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Size
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium text-muted-foreground">
                    Modified
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium text-muted-foreground">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-muted-foreground"
                    >
                      <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                    </td>
                  </tr>
                ) : (
                  <>
                    {/* Folders */}
                    {data?.folders?.map((folder: any) => (
                      <tr
                        key={folder.prefix}
                        className="border-b last:border-0 hover:bg-muted/30 cursor-pointer"
                        onClick={() => navigateToPrefix(folder.prefix)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Folder className="h-4 w-4 text-primary" />
                            <span className="font-medium">
                              {folder.prefix.slice(prefix.length, -1)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          --
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          Folder
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          --
                        </td>
                        <td className="px-4 py-3" />
                      </tr>
                    ))}
                    {/* Files */}
                    {data?.contents?.map((obj: any) => (
                      <tr
                        key={obj.key}
                        className="border-b last:border-0 hover:bg-muted/30"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <File className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {obj.key.slice(prefix.length)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatBytes(obj.size)}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {obj.contentType}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {formatDate(obj.lastModified)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(obj.key)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {(!data?.folders?.length && !data?.contents?.length) && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-8 text-center text-muted-foreground"
                        >
                          <File className="mx-auto h-8 w-8 mb-2 opacity-50" />
                          This bucket is empty. Upload files to get started.
                        </td>
                      </tr>
                    )}
                  </>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
