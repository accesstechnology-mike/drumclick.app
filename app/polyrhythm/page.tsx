'use client';

import PolyMetronome from '../components/PolyMetronome';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function PolyrhythmPage() {
  return (
    <main className="min-h-[100svh] max-h-[100svh] flex items-center justify-center bg-gradient-to-br from-purple-500 to-pink-500 p-2 sm:p-4">
      <Card className="w-full max-w-md h-[calc(100svh-1rem)] sm:h-[calc(100svh-2rem)] flex flex-col overflow-hidden">
        <CardHeader className="py-3 sm:py-6">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-center flex items-center justify-center gap-2">
            <img 
              src="/images/DrumClick_logo.png" 
              alt="DrumClick Logo" 
              className="h-6 sm:h-8 w-auto"
            />
            DrumClick
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col overflow-hidden">
          <PolyMetronome />
        </CardContent>
      </Card>
    </main>
  );
} 