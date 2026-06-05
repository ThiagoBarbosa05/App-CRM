import { useEffect } from "react";
import { LoadingScreen } from "@/components/loading-screen";

export default function Home() {
  useEffect(() => {
    window.location.href = "/dashboard";
  }, []);

  return <LoadingScreen />;
}