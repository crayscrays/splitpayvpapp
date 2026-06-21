import { HashRouter, Route, Routes, useLocation } from "react-router-dom";
import { SplitPayProvider, useSplitPay } from "./lib/splitpay-context";
import { ConnectWallet } from "./pages/ConnectWallet";
import { Dashboard } from "./pages/Dashboard";
import { GroupDetail } from "./pages/GroupDetail";
import { AddExpense } from "./pages/AddExpense";
import { ExpenseDetail } from "./pages/ExpenseDetail";
import { SettleUp } from "./pages/SettleUp";
import { JoinGroup } from "./pages/JoinGroup";
import { DebugPage } from "./pages/DebugPage";
import { GroupsPage } from "./pages/GroupsPage";
import { WalletPage } from "./pages/WalletPage";
import { BottomNav } from "./components/BottomNav";

const MAIN_ROUTES = ["/", "/groups", "/wallet"];

function AppShell() {
  const sp = useSplitPay();
  const { pathname } = useLocation();

  if (pathname === "/debug") return <DebugPage />;

  if (sp.loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-text-muted text-sm">Loading…</div>
      </div>
    );
  }

  if (sp.mode === "disconnected") {
    return <ConnectWallet />;
  }

  const showNav = MAIN_ROUTES.includes(pathname);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/wallet" element={<WalletPage />} />
          <Route path="/group/:groupId" element={<GroupDetail />} />
          <Route path="/group/:groupId/add" element={<AddExpense />} />
          <Route path="/group/:groupId/expense/:expenseId" element={<ExpenseDetail />} />
          <Route path="/group/:groupId/expense/:expenseId/edit" element={<AddExpense />} />
          <Route path="/group/:groupId/settle" element={<SettleUp />} />
          <Route path="/join/:inviteCode" element={<JoinGroup />} />
          <Route path="*" element={<Dashboard />} />
        </Routes>
      </div>
      {showNav && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <SplitPayProvider>
      <HashRouter>
        <div className="h-[100dvh] w-full flex flex-col items-center bg-bg overflow-hidden">
          <div className="w-full max-w-[480px] h-full flex flex-col bg-bg overflow-hidden relative">
            <AppShell />
          </div>
        </div>
      </HashRouter>
    </SplitPayProvider>
  );
}
