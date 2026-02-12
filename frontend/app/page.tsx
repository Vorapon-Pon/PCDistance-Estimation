"use client";

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Lock } from "lucide-react";

export default function LoginPage() {
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
          
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="example@gmail.com"
                required
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center">
                <Label htmlFor="password">Password</Label>
                <Link href="#" className="ml-auto inline-block text-sm underline">
                  Forgot your password?
                </Link>
              </div>
              <Input 
                id="password" 
                type="password" 
                required 
              />
            </div>
            
            {/* Login Button */}
            <Link href="/dashboard">
                <Button type="submit" className="w-full">
                Login
                </Button>
            </Link>
            
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

          </div>
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