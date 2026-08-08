import { useEffect, useMemo, useState } from "react";
import { Search, Plus, Car, X, MapPin, LogIn, LogOut, ShieldCheck, UserPlus } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Toaster, toast } from "sonner";
import VehicleCard from "../components/VehicleCard";
import VehicleForm from "../components/VehicleForm";
import AuthDialog from "../components/AuthDialog";
import { useAuth } from "../context/AuthContext";
import { listVehicles, deleteVehicle } from "../lib/api";

export default function Home() {
  const { user, logout, loading: authLoading } = useAuth();
  const [query, setQuery] = useState("");
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("search");
  const [addMode, setAddMode] = useState(null); // "member" | "guest" | null
  const [editing, setEditing] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authDefaultTab, setAuthDefaultTab] = useState("login");

  const load = async () => {
    setLoading(true);
    try {
      const list = await listVehicles();
      setVehicles(list);
    } catch (e) {
      toast.error("Could not load directory");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    // refresh directory on login/logout so ownership badges update
    if (!authLoading) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading]);

  const normalized = query.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

  const searchResults = useMemo(() => {
    if (!normalized) return [];
    return vehicles.filter((v) =>
      (v.vehicle_number || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().includes(normalized)
    );
  }, [vehicles, normalized]);

  const myVehicles = useMemo(
    () => (user ? vehicles.filter((v) => v.user_id === user.id) : []),
    [vehicles, user]
  );

  const isMine = (v) => user && v.user_id === user.id;
  const canEdit = (v) => Boolean(user && (v.user_id === user.id || user.is_admin));

  const openAdd = (mode) => {
    if (!user) {
      setAuthDefaultTab("signup");
      setAuthOpen(true);
      return;
    }
    setAddMode(mode);
  };

  const handleSaved = () => {
    setAddMode(null);
    setEditing(null);
    load();
  };

  const doDelete = async () => {
    if (!confirmDel) return;
    try {
      await deleteVehicle(confirmDel.id);
      toast.success("Vehicle removed");
      setConfirmDel(null);
      load();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not delete");
    }
  };

  const dialogOpen = Boolean(addMode) || Boolean(editing);

  return (
    <div className="min-h-screen bg-[#efeae1] noise-bg" data-testid="app-root">
      <Toaster position="top-center" richColors />

      <div className="w-full max-w-md mx-auto min-h-screen bg-[#efeae1] pb-28 relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-[#efeae1]/85 border-b-[1.5px] border-black">
          <div className="px-5 pt-6 pb-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-sm bg-[#002FA7] flex items-center justify-center border-[1.5px] border-black">
                  <Car className="w-5 h-5 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <div className="label-eyebrow text-[0.6rem]">Society</div>
                  <div className="font-heading font-black text-lg leading-none" data-testid="app-title">
                    Shiv Sampada
                  </div>
                </div>
              </div>

              {user ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      data-testid="user-chip"
                      className="h-10 rounded-sm border-[1.5px] border-black bg-white btn-brutalist px-3 flex items-center gap-2 hover:bg-gray-50"
                    >
                      {user.is_admin ? (
                        <ShieldCheck className="w-4 h-4 text-[#002FA7]" strokeWidth={2.5} />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-[#16A34A]" />
                      )}
                      <span className="font-mono-plate font-bold text-sm">
                        {user.is_admin ? "ADMIN" : user.flat_number}
                      </span>
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="rounded-sm border-[1.5px] border-black w-48"
                  >
                    <DropdownMenuItem
                      data-testid="menu-add-mine"
                      onClick={() => openAdd("member")}
                      className="cursor-pointer font-medium"
                    >
                      <Plus className="w-4 h-4 mr-2" /> Add my vehicle
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      data-testid="menu-add-guest"
                      onClick={() => openAdd("guest")}
                      className="cursor-pointer font-medium"
                    >
                      <UserPlus className="w-4 h-4 mr-2" /> Add guest vehicle
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      data-testid="menu-logout"
                      onClick={() => {
                        logout();
                        toast.success("Signed out");
                      }}
                      className="cursor-pointer font-medium text-[#FF3333] focus:text-[#FF3333]"
                    >
                      <LogOut className="w-4 h-4 mr-2" /> Sign out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex gap-2">
                  <Button
                    onClick={() => {
                      setAuthDefaultTab("login");
                      setAuthOpen(true);
                    }}
                    data-testid="open-signin-btn"
                    variant="outline"
                    className="h-10 rounded-sm border-black border-[1.5px] bg-white text-black hover:bg-gray-100 btn-brutalist font-semibold px-3"
                  >
                    <LogIn className="w-4 h-4 mr-1" strokeWidth={2.5} />
                    Sign in
                  </Button>
                  <Button
                    onClick={() => {
                      setAuthDefaultTab("signup");
                      setAuthOpen(true);
                    }}
                    data-testid="open-signup-btn"
                    className="h-10 rounded-sm bg-[#002FA7] hover:bg-[#0033b3] text-white btn-brutalist font-semibold px-3"
                  >
                    <Plus className="w-4 h-4 mr-1" strokeWidth={2.5} />
                    Sign up
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="flex border-t-[1.5px] border-black">
            {[
              { id: "search", label: "Search" },
              { id: "directory", label: "Directory" },
              { id: "mine", label: user?.is_admin ? "Admin" : "My Cars" },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`tab-${t.id}`}
                className={`flex-1 py-3 text-xs font-heading font-bold uppercase tracking-[0.15em] transition-colors ${
                  tab === t.id
                    ? "bg-[#0a0a0a] text-[#fef7cd]"
                    : "bg-transparent text-[#0a0a0a] hover:bg-black/5"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </header>

        <main className="px-5 pt-6">
          {tab === "search" && (
            <section data-testid="search-section">
              <div className="mb-2">
                <div className="label-eyebrow">Blocked-in?</div>
              </div>
              <h1 className="font-heading text-4xl font-black leading-[1.05] mb-6">
                Type the plate,<br />
                <span className="text-[#002FA7]">call the owner.</span>
              </h1>

              <div className="relative mb-6">
                <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 z-10" />
                <Input
                  data-testid="search-input"
                  value={query}
                  onChange={(e) => setQuery(e.target.value.toUpperCase())}
                  placeholder="MH 01 AB 1234"
                  autoFocus
                  className="h-16 pl-12 pr-12 rounded-sm border-black border-[1.5px] bg-[#fef7cd] font-mono-plate text-xl font-bold uppercase text-center focus-visible:ring-0 focus-visible:border-[#002FA7]"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    data-testid="clear-search-btn"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center rounded-full hover:bg-black/10"
                    aria-label="Clear"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {!query && (
                <div className="card-flat p-5 mb-4" data-testid="search-hint">
                  <div className="label-eyebrow mb-2">How it works</div>
                  <ol className="space-y-2 text-sm font-medium">
                    <li className="flex gap-3">
                      <span className="font-heading font-black text-[#002FA7]">01</span>
                      <span>Type any part of the vehicle number blocking you in.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-heading font-black text-[#002FA7]">02</span>
                      <span>Tap the green Call button to reach the owner instantly.</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="font-heading font-black text-[#002FA7]">03</span>
                      <span>{user ? "Add your own or a guest's car anytime." : "Sign up to add your car or a guest's."}</span>
                    </li>
                  </ol>
                </div>
              )}

              {query && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="label-eyebrow" data-testid="search-count">
                      {searchResults.length} match{searchResults.length === 1 ? "" : "es"}
                    </span>
                  </div>
                  {searchResults.length === 0 ? (
                    <div className="card-flat p-6 text-center" data-testid="no-results">
                      <div className="font-heading font-black text-xl mb-1">No match found</div>
                      <p className="text-sm text-gray-600">
                        This vehicle isn&apos;t registered yet. Ask the owner to add their car.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 stagger">
                      {searchResults.map((v, i) => (
                        <VehicleCard
                          key={v.id}
                          vehicle={v}
                          index={i}
                          isMine={isMine(v)}
                          canEdit={canEdit(v)}
                          onEdit={setEditing}
                          onDelete={setConfirmDel}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {tab === "directory" && (
            <section data-testid="directory-section">
              <div className="label-eyebrow mb-2">Full Directory</div>
              <h2 className="font-heading text-3xl font-black leading-tight mb-1">
                All Registered Cars
              </h2>
              <p className="text-sm text-gray-600 mb-6 flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Shiv Sampada Residency
              </p>

              {loading ? (
                <div className="text-sm text-gray-500" data-testid="directory-loading">Loading...</div>
              ) : vehicles.length === 0 ? (
                <div className="card-flat p-6 text-center" data-testid="directory-empty">
                  <div className="font-heading font-black text-xl mb-1">Directory is empty</div>
                  <p className="text-sm text-gray-600 mb-4">Be the first to sign up and add your vehicle.</p>
                  <Button
                    onClick={() => {
                      setAuthDefaultTab("signup");
                      setAuthOpen(true);
                    }}
                    data-testid="empty-signup-btn"
                    className="rounded-sm bg-[#002FA7] hover:bg-[#0033b3] text-white btn-brutalist"
                  >
                    <UserPlus className="w-4 h-4 mr-1" /> Sign up
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 stagger">
                  {vehicles.map((v, i) => (
                    <VehicleCard
                      key={v.id}
                      vehicle={v}
                      index={i}
                      isMine={isMine(v)}
                      canEdit={canEdit(v)}
                      onEdit={setEditing}
                      onDelete={setConfirmDel}
                    />
                  ))}
                </div>
              )}
            </section>
          )}

          {tab === "mine" && (
            <section data-testid="mine-section">
              {!user ? (
                <div className="card-flat p-6 text-center" data-testid="mine-locked">
                  <LogIn className="w-8 h-8 mx-auto mb-3 text-gray-500" />
                  <div className="font-heading font-black text-xl mb-1">Sign in required</div>
                  <p className="text-sm text-gray-600 mb-4">
                    Sign in to manage your vehicles, or register your flat if it&apos;s your first time.
                  </p>
                  <div className="flex gap-2 justify-center">
                    <Button
                      onClick={() => {
                        setAuthDefaultTab("login");
                        setAuthOpen(true);
                      }}
                      data-testid="mine-signin-btn"
                      variant="outline"
                      className="rounded-sm border-black border-[1.5px] bg-white btn-brutalist"
                    >
                      Sign in
                    </Button>
                    <Button
                      onClick={() => {
                        setAuthDefaultTab("signup");
                        setAuthOpen(true);
                      }}
                      data-testid="mine-signup-btn"
                      className="rounded-sm bg-[#002FA7] hover:bg-[#0033b3] text-white btn-brutalist"
                    >
                      Sign up
                    </Button>
                  </div>
                </div>
              ) : user.is_admin ? (
                <div>
                  <div className="label-eyebrow mb-2 flex items-center gap-2">
                    <ShieldCheck className="w-3 h-3" /> Admin panel
                  </div>
                  <h2 className="font-heading text-3xl font-black leading-tight mb-6">
                    Manage every vehicle
                  </h2>
                  <div className="space-y-3 stagger">
                    {vehicles.map((v, i) => (
                      <VehicleCard
                        key={v.id}
                        vehicle={v}
                        index={i}
                        isMine={false}
                        canEdit
                        onEdit={setEditing}
                        onDelete={setConfirmDel}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="label-eyebrow mb-2">Flat {user.flat_number}</div>
                  <h2 className="font-heading text-3xl font-black leading-tight mb-6">
                    My vehicles
                  </h2>
                  <div className="flex gap-2 mb-4">
                    <Button
                      onClick={() => openAdd("member")}
                      data-testid="add-my-vehicle-btn"
                      className="flex-1 h-11 rounded-sm bg-[#002FA7] hover:bg-[#0033b3] text-white btn-brutalist"
                    >
                      <Plus className="w-4 h-4 mr-1" /> My car
                    </Button>
                    <Button
                      onClick={() => openAdd("guest")}
                      data-testid="add-guest-vehicle-btn"
                      variant="outline"
                      className="flex-1 h-11 rounded-sm border-black border-[1.5px] bg-white btn-brutalist"
                    >
                      <UserPlus className="w-4 h-4 mr-1" /> Guest
                    </Button>
                  </div>

                  {myVehicles.length === 0 ? (
                    <div className="card-flat p-6 text-center" data-testid="mine-empty">
                      <div className="font-heading font-black text-xl mb-1">Nothing here yet</div>
                      <p className="text-sm text-gray-600">
                        Add your first vehicle so neighbours can reach you.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3 stagger">
                      {myVehicles.map((v, i) => (
                        <VehicleCard
                          key={v.id}
                          vehicle={v}
                          index={i}
                          isMine
                          canEdit
                          onEdit={setEditing}
                          onDelete={setConfirmDel}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          )}
        </main>

        <footer className="px-5 py-6 mt-8 text-center">
          <div className="label-eyebrow">Shiv Sampada · Parking Directory</div>
        </footer>
      </div>

      {/* Auth dialog */}
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} defaultTab={authDefaultTab} />

      {/* Vehicle add / edit */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAddMode(null);
            setEditing(null);
          }
        }}
      >
        <DialogContent
          data-testid="vehicle-dialog"
          className="max-w-md rounded-sm border-[1.5px] border-black bg-white p-6 max-h-[92vh] overflow-y-auto"
        >
          <DialogHeader>
            <DialogTitle className="font-heading text-2xl font-black">
              {editing
                ? "Edit Vehicle"
                : addMode === "guest"
                  ? "Add Guest Vehicle"
                  : "Add My Vehicle"}
            </DialogTitle>
            <DialogDescription className="text-sm text-gray-600">
              {editing
                ? "Update the contact and vehicle details."
                : addMode === "guest"
                  ? "For visitors parked in the society. You'll own this entry."
                  : "Neighbours will use this to reach you when you're parked in."}
            </DialogDescription>
          </DialogHeader>
          <VehicleForm
            initial={editing}
            mode={editing ? (editing.is_guest ? "guest" : "member") : addMode || "member"}
            onSuccess={handleSaved}
            onCancel={() => {
              setAddMode(null);
              setEditing(null);
            }}
          />
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog
        open={Boolean(confirmDel)}
        onOpenChange={(open) => !open && setConfirmDel(null)}
      >
        <AlertDialogContent
          data-testid="delete-dialog"
          className="max-w-sm rounded-sm border-[1.5px] border-black bg-white"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-black">
              Remove this vehicle?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel?.vehicle_number} will be permanently removed from the directory.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              data-testid="cancel-delete-btn"
              className="rounded-sm border-[1.5px] border-black"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={doDelete}
              data-testid="confirm-delete-btn"
              className="rounded-sm bg-[#FF3333] text-white border-[1.5px] border-black hover:bg-[#e02929]"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
