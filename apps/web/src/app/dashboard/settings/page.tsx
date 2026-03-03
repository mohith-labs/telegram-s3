"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function SettingsPage() {
  const [s3Endpoint, setS3Endpoint] = useState("http://localhost:4000");

  useEffect(() => {
    const config = (window as any).__TGS3_CONFIG__;
    if (config?.s3ApiUrl) {
      setS3Endpoint(config.s3ApiUrl);
    }
  }, []);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Application configuration
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>S3 Endpoint</CardTitle>
          <CardDescription>
            Configure your S3 clients to use this endpoint
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>S3 API Endpoint</Label>
            <Input
              readOnly
              value={s3Endpoint}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label>Region</Label>
            <Input readOnly value="us-east-1" className="font-mono" />
          </div>
          <div className="rounded-xl bg-muted p-4">
            <p className="text-sm font-medium mb-2">AWS CLI Configuration</p>
            <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
              {`aws configure set aws_access_key_id <your-access-key>
aws configure set aws_secret_access_key <your-secret-key>
aws configure set default.region us-east-1

# Example commands:
aws s3 ls --endpoint-url ${s3Endpoint}
aws s3 mb s3://my-bucket --endpoint-url ${s3Endpoint}
aws s3 cp file.txt s3://my-bucket/ --endpoint-url ${s3Endpoint}`}
            </pre>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
          <CardDescription>Telegram S3 Storage</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono">0.0.1</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Backend</span>
              <span>NestJS</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Frontend</span>
              <span>Next.js + shadcn/ui</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Storage</span>
              <span>Telegram MTProto</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Database</span>
              <span>SQLite + Prisma</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
