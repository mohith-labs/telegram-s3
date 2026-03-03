"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
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
import { toast } from "sonner";
import {
  CheckCircle2,
  ChevronRight,
  Loader2,
  Send,
  Unplug,
} from "lucide-react";

type Step = "status" | "api" | "phone" | "code" | "2fa" | "connected";

export default function TelegramPage() {
  const [step, setStep] = useState<Step>("status");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<any>(null);

  // Form state
  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phoneCodeHash, setPhoneCodeHash] = useState("");
  const [code, setCode] = useState("");
  const [password2FA, setPassword2FA] = useState("");

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    try {
      const s = await api.getTelegramStatus();
      setStatus(s);
      setStep(s.connected ? "connected" : "api");
    } catch {
      setStep("api");
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.sendCode(
        parseInt(apiId),
        apiHash,
        phoneNumber,
      );
      setPhoneCodeHash(result.phoneCodeHash);
      setStep("code");
      toast.success("Verification code sent to your Telegram app");
    } catch (error: any) {
      toast.error(error.message || "Failed to send code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await api.verifyCode(phoneNumber, code, phoneCodeHash);
      if (result.need2FA) {
        setStep("2fa");
        toast.info("2FA password required");
      } else {
        setStep("connected");
        toast.success("Telegram connected successfully!");
        checkStatus();
      }
    } catch (error: any) {
      toast.error(error.message || "Invalid code");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.verify2FA(password2FA);
      setStep("connected");
      toast.success("Telegram connected successfully!");
      checkStatus();
    } catch (error: any) {
      toast.error(error.message || "Invalid 2FA password");
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await api.disconnectTelegram();
      setStatus(null);
      setStep("api");
      toast.success("Telegram disconnected");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: "api", label: "API Credentials" },
    { id: "phone", label: "Phone Number" },
    { id: "code", label: "Verification" },
    { id: "connected", label: "Connected" },
  ];

  const currentStepIndex = steps.findIndex(
    (s) => s.id === step || (step === "2fa" && s.id === "code"),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">
          Telegram Connection
        </h1>
        <p className="text-muted-foreground mt-1">
          Connect your Telegram account to enable S3 storage
        </p>
      </div>

      {/* Progress Steps */}
      {step !== "status" && step !== "connected" && (
        <div className="flex items-center gap-2">
          {steps.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-medium ${
                  i <= currentStepIndex
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i < currentStepIndex ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              <span className="ml-2 text-sm hidden sm:inline">{s.label}</span>
              {i < steps.length - 1 && (
                <ChevronRight className="mx-2 h-4 w-4 text-muted-foreground" />
              )}
            </div>
          ))}
        </div>
      )}

      {/* Connected State */}
      {step === "connected" && status && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-500/10">
                <Send className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-green-500">Connected</CardTitle>
                <CardDescription>
                  Your Telegram account is linked
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2 text-sm">
              {status.firstName && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name</span>
                  <span className="font-medium">
                    {status.firstName} {status.lastName || ""}
                  </span>
                </div>
              )}
              {status.username && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Username</span>
                  <span className="font-mono">@{status.username}</span>
                </div>
              )}
              {status.phoneNumber && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Phone</span>
                  <span className="font-mono">{status.phoneNumber}</span>
                </div>
              )}
            </div>
            <Button
              variant="destructive"
              onClick={handleDisconnect}
              disabled={loading}
            >
              <Unplug className="mr-2 h-4 w-4" />
              Disconnect
            </Button>
          </CardContent>
        </Card>
      )}

      {/* API Credentials Step */}
      {step === "api" && (
        <Card>
          <CardHeader>
            <CardTitle>Telegram API Credentials</CardTitle>
            <CardDescription>
              Get your API ID and Hash from{" "}
              <a
                href="https://my.telegram.org"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline"
              >
                my.telegram.org
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep("phone");
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="apiId">API ID</Label>
                <Input
                  id="apiId"
                  type="number"
                  placeholder="12345678"
                  value={apiId}
                  onChange={(e) => setApiId(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apiHash">API Hash</Label>
                <Input
                  id="apiHash"
                  placeholder="0123456789abcdef"
                  value={apiHash}
                  onChange={(e) => setApiHash(e.target.value)}
                  required
                />
              </div>
              <Button type="submit">
                Continue <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Phone Number Step */}
      {step === "phone" && (
        <Card>
          <CardHeader>
            <CardTitle>Phone Number</CardTitle>
            <CardDescription>
              Enter your Telegram phone number with country code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+1234567890"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Code
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Verification Code Step */}
      {step === "code" && (
        <Card>
          <CardHeader>
            <CardTitle>Verification Code</CardTitle>
            <CardDescription>
              Enter the code sent to your Telegram app
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">Code</Label>
                <Input
                  id="code"
                  placeholder="12345"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  autoFocus
                  maxLength={6}
                  className="text-center text-2xl tracking-widest font-mono"
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      {/* 2FA Step */}
      {step === "2fa" && (
        <Card>
          <CardHeader>
            <CardTitle>Two-Factor Authentication</CardTitle>
            <CardDescription>
              Enter your 2FA password
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify2FA} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="2fa">Password</Label>
                <Input
                  id="2fa"
                  type="password"
                  placeholder="Enter your 2FA password"
                  value={password2FA}
                  onChange={(e) => setPassword2FA(e.target.value)}
                  required
                  autoFocus
                />
              </div>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
