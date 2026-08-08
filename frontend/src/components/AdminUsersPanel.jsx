import { useEffect, useState } from "react";
import { KeyRound, Car, Users2, AlertTriangle } from "lucide-react";
import { Button } from "./ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import { toast } from "sonner";
import { adminListUsers, adminResetFlat } from "../lib/api";

export const AdminUsersPanel = ({ onAfterReset }) => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const list = await adminListUsers();
      setUsers(list);
    } catch (e) {
      toast.error("Could not load residents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const doReset = async () => {
    if (!confirm) return;
    setBusy(true);
    try {
      await adminResetFlat(confirm.id);
      toast.success(`Flat ${confirm.flat_number} reset — ready for the new owner`);
      setConfirm(null);
      await load();
      onAfterReset?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not reset flat");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-8" data-testid="admin-users-panel">
      <div className="flex items-center gap-2 mb-2">
        <Users2 className="w-4 h-4" />
        <span className="label-eyebrow">Registered Residents · {users.length}</span>
      </div>
      <h3 className="font-heading text-xl font-black mb-4">Reset a flat</h3>

      {loading ? (
        <div className="text-sm text-gray-500" data-testid="admin-users-loading">Loading residents...</div>
      ) : users.length === 0 ? (
        <div className="card-flat p-5 text-sm text-gray-600" data-testid="admin-users-empty">
          No residents registered yet.
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="card-flat p-4 flex items-center justify-between gap-3"
              data-testid={`admin-user-row-${u.flat_number}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <span className="font-mono-plate font-bold text-lg">{u.flat_number}</span>
                  <span className="font-semibold text-sm truncate">{u.owner_name}</span>
                </div>
                <div className="text-xs text-gray-600 flex items-center gap-3 mt-0.5">
                  <span>{u.phone}</span>
                  <span className="flex items-center gap-1">
                    <Car className="w-3 h-3" /> {u.vehicle_count}
                  </span>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => setConfirm(u)}
                data-testid={`admin-reset-btn-${u.flat_number}`}
                className="h-11 rounded-sm bg-[#FFD700] hover:bg-[#e6c200] text-black border-[1.5px] border-black btn-brutalist font-semibold"
              >
                <KeyRound className="w-4 h-4 mr-1" /> Reset
              </Button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={Boolean(confirm)} onOpenChange={(open) => !open && setConfirm(null)}>
        <AlertDialogContent
          data-testid="reset-dialog"
          className="max-w-sm rounded-sm border-[1.5px] border-black bg-white"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="font-heading font-black flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-[#FF3333]" />
              Reset Flat {confirm?.flat_number}?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              This deletes the current resident ({confirm?.owner_name}) and all {confirm?.vehicle_count} of their vehicles.
              The flat becomes available for a new owner to sign up. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="cancel-reset-btn" className="rounded-sm border-[1.5px] border-black">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={doReset}
              disabled={busy}
              data-testid="confirm-reset-btn"
              className="rounded-sm bg-[#FF3333] text-white border-[1.5px] border-black hover:bg-[#e02929]"
            >
              {busy ? "Resetting..." : "Yes, reset flat"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminUsersPanel;
