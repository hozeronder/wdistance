import { NextResponse } from "next/server";

const FASTAPI_URL = "https://wdistancebackend.vercel.app";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lng = searchParams.get('lng');

    const response = await fetch(
      `${FASTAPI_URL}/api/isochrone?lat=${lat}&lng=${lng}`
    );
    
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An unknown error occurred" }, 
      { status: 500 }
    );
  }
} 