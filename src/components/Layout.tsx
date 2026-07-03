import { Outlet } from "react-router-dom";
import { useState, useCallback, useEffect } from "react";
import { Maximize, Minimize } from "lucide-react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import AppSidebar from "@/components/AppSidebar";
import UserBar from "@/components/UserBar";
import SyncStatus from "@/components/SyncStatus";
import { useAuth } from "@/hooks/useAuth";

export function Layout() {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { isLoggedIn } = useAuth();

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        setIsFullscreen(true);
      }).catch(() => {});
    } else {
      document.exitFullscreen().then(() => {
        setIsFullscreen(false);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex flex-col min-w-0 overflow-x-hidden">
          {/* 顶部操作栏 */}
          <div className="sticky top-0 z-40 flex h-12 items-center justify-between border-b border-border/40 bg-background/80 backdrop-blur-md px-3 shrink-0">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="size-9" />
            </div>
            <div className="flex items-center gap-2">
              <SyncStatus />
              {isLoggedIn && <UserBar />}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9"
                    onClick={toggleFullscreen}
                    aria-label={isFullscreen ? "退出全屏" : "全屏编辑"}
                  >
                    {isFullscreen ? (
                      <Minimize className="size-4" />
                    ) : (
                      <Maximize className="size-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  {isFullscreen ? "退出全屏" : "全屏编辑"}
                </TooltipContent>
              </Tooltip>
            </div>
          </div>

          {/* 主内容区 */}
          <main className="flex-1 w-full overflow-hidden">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
