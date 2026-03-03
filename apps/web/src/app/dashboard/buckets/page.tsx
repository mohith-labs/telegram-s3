"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Database, FileText, HardDrive, Loader2, Plus, Trash2 } from "lucide-react";

export default function BucketsPage() {
  const router = useRouter();
  const [buckets, setBuckets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [newBucketName, setNewBucketName] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ name: string; objectCount: number } | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadBuckets();
  }, []);

  const loadBuckets = async () => {
    try {
      const result = await api.listBuckets();
      setBuckets(result);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      await api.createBucket(newBucketName);
      setNewBucketName("");
      setCreateOpen(false);
      loadBuckets();
      toast.success(`Bucket "${newBucketName}" created`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setCreating(false);
    }
  };

  const openDeleteDialog = (name: string, objectCount: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteTarget({ name, objectCount });
    setDeleteConfirmName("");
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.deleteBucket(deleteTarget.name, deleteTarget.objectCount > 0);
      setDeleteTarget(null);
      loadBuckets();
      toast.success(`Bucket "${deleteTarget.name}" deleted`);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Buckets</h1>
          <p className="text-muted-foreground mt-1">
            Manage your S3 storage buckets
          </p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Bucket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Bucket</DialogTitle>
              <DialogDescription>
                A new Telegram channel will be created for this bucket
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="bucketName">Bucket Name</Label>
                <Input
                  id="bucketName"
                  placeholder="my-bucket"
                  value={newBucketName}
                  onChange={(e) =>
                    setNewBucketName(e.target.value.toLowerCase())
                  }
                  required
                  autoFocus
                  pattern="^[a-z0-9][a-z0-9.-]*[a-z0-9]$"
                  title="Lowercase letters, numbers, hyphens, and periods (3-63 chars)"
                />
                <p className="text-xs text-muted-foreground">
                  Must be DNS-compatible: lowercase letters, numbers, hyphens,
                  and periods
                </p>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => setCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={creating}>
                  {creating && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Bucket Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : buckets.length === 0 ? (
        <Card className="py-12">
          <CardContent className="text-center">
            <Database className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No buckets yet</h3>
            <p className="text-muted-foreground mt-1">
              Create your first bucket to start storing files
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {buckets.map((bucket) => (
            <Card
              key={bucket.id}
              className="cursor-pointer hover:border-primary/30 transition-all group"
              onClick={() => router.push(`/dashboard/buckets/${bucket.name}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <Database className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">
                        {bucket.name}
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Created {formatDate(bucket.createdAt)}
                      </CardDescription>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive h-8 w-8"
                    onClick={(e) => openDeleteDialog(bucket.name, bucket.objectCount || 0, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-6 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>{bucket.objectCount || 0} objects</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <HardDrive className="h-4 w-4" />
                    <span>{formatBytes(bucket.totalSize || 0)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Bucket</DialogTitle>
            <DialogDescription>
              {deleteTarget && deleteTarget.objectCount > 0 ? (
                <>
                  This bucket contains <strong>{deleteTarget.objectCount} object{deleteTarget.objectCount > 1 ? "s" : ""}</strong>.
                  All objects and the associated Telegram channel will be permanently deleted.
                </>
              ) : (
                "This will delete the bucket and its associated Telegram channel."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="confirmName">
              Type <strong>{deleteTarget?.name}</strong> to confirm
            </Label>
            <Input
              id="confirmName"
              placeholder="Bucket name"
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteConfirmName !== deleteTarget?.name || deleting}
              onClick={handleDelete}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Bucket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
