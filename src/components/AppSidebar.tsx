import { NavLink, useLocation } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar';
import { LayoutDashboard, ClipboardList, PackageSearch, Truck } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/', label: '首页总览', icon: LayoutDashboard },
  { path: '/procurement', label: '采购需求', icon: ClipboardList },
  { path: '/unreceived', label: '未到货产品', icon: PackageSearch },
  { path: '/shipping', label: '快递发货需求', icon: Truck },
];

export default function AppSidebar() {
  const { pathname } = useLocation();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-3 group-data-[state=collapsed]:px-0 group-data-[state=collapsed]:justify-center">
          <div className="size-8 shrink-0 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
            试
          </div>
          <div className="flex-1 min-w-0 group-data-[state=collapsed]:hidden">
            <div className="text-sm font-semibold truncate">试剂订单管理</div>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup className="p-2">
          <SidebarMenu>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.path === '/'
                  ? pathname === '/'
                  : pathname === item.path || pathname.startsWith(`${item.path}/`);
              return (
                <SidebarMenuItem key={item.path}>
                  <SidebarMenuButton asChild tooltip={item.label} isActive={isActive}>
                    <NavLink
                      to={item.path}
                      end={item.path === '/'}
                      className="flex items-center gap-2"
                    >
                      <Icon className="size-4 shrink-0" />
                      <span className="group-data-[state=collapsed]:hidden">
                        {item.label}
                      </span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
