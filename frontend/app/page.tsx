"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/client";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Loader2, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();

  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      setError(error.message);
      setIsLoading(false);
    } else {
      router.refresh();
      router.push("/dashboard"); 
    }
  };

  return (
    <div className="w-full h-screen lg:grid lg:grid-cols-2">
      
      {/* LeftSide: Form Login */}
      <div className="flex items-center justify-center py-12 px-8 bg-white">
        <div className="mx-auto grid w-[400px] gap-6">
          <div className="grid gap-2 text-center">
            <h1 className="text-3xl font-bold text-slate-900">PointCloud Distance Estimation</h1>
            <p className="text-balance text-muted-foreground">
              Enter your email below to login to your account
            </p>
          </div>
          
          <form className="grid gap-4" onSubmit={handleLogin}>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@gmail.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link href="#" className="ml-auto inline-block text-sm underline">
                  Forgot your password?
                </Link>
              </div>
              
              <div className="relative">
              <Input 
                id="password" 
                type={showPassword ? "text" : "password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {/* Display Error Message */}
            {error && <p className="text-sm text-red-500">{error}</p>}


            {/* Register Link */}
            <div className="grid gap-2">
              <Link href="/signup" className="items-start ml-auto inline-block text-sm underline">
                Sign Up
              </Link> 
            </div>
            
            
            {/* Login Button */}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging in...
                </>
              ) : (
                "Login"
              )}
            </Button>
            
            
            <div className="relative">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-muted-foreground">
                    Or continue as
                    </span>
                </div>
            </div>

            {/* Guest Button */}
            <Link href="/dashboard?role=guest"> 
                <Button variant="outline" className="w-full gap-2">
                    Guest / Demo User 
                    <ArrowRight className="h-4 w-4" />
                </Button>
            </Link>

          </form>
        </div>
      </div>

      {/* RightSide: Show Image */}
      <div className="hidden bg-slate-100 lg:block relative">
    
        <Image
          src="/images/3dpc.png"
          alt="LiDAR Point Cloud Visualization"
          fill
          className="object-cover grayscale hover:grayscale-0 transition-all duration-500"
          priority
        />
        <div className="absolute bottom-10 left-10 text-white z-10 p-6 bg-black/50 backdrop-blur-sm rounded-xl max-w-md">
            <h3 className="font-bold text-xl">3D Object Detection</h3>
            <p className="text-sm opacity-90">
                Advanced Sensor Fusion utilizing Panorama Imagery and LiDAR Point Clouds for precise asset mapping.
            </p>
        </div>
      </div>

    </div>
  );
}