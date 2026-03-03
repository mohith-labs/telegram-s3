"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Database, FileText, HardDrive, Send } from "lucide-react";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalBuckets: 0,
    totalObjects: 0,
    totalSize: 0,
  });
  const [telegramStatus, setTelegramStatus] = useState({ connected: false });

  useEffect(() => {
    api.getStats().then(setStats).catch(() => {});
    api.getTelegramStatus().then(setTelegramStatus).catch(() => {});
  }, []);

  const cards = [
    {
      title: "Telegram",
      value: telegramStatus.connected ? "Connected" : "Disconnected",
      description: telegramStatus.connected
        ? "Account linked"
        : "Setup required",
      icon: Send,
      color: telegramStatus.connected ? "text-green-500" : "text-red-500",
    },
    {
      title: "Buckets",
      value: stats.totalBuckets.toString(),
      description: "Total storage buckets",
      icon: Database,
      color: "text-primary",
    },
    {
      title: "Objects",
      value: stats.totalObjects.toString(),
      description: "Total stored objects",
      icon: FileText,
      color: "text-primary",
    },
    {
      title: "Storage Used",
      value: formatBytes(stats.totalSize),
      description: "Total storage consumption",
      icon: HardDrive,
      color: "text-primary",
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Overview of your Telegram S3 storage
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <card.icon className={`h-5 w-5 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              <p className="text-xs text-muted-foreground mt-1">
                {card.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
