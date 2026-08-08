import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { createVehicle, updateVehicle, formatApiErrorDetail } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const inputCls =
  "h-12 border-black border-[1.5px] rounded-sm bg-white text-base font-medium focus-visible:ring-0 focus-visible:border-[#002FA7]";
const plateCls =
  "h-14 border-black border-[1.5px] rounded-sm bg-[#fef7cd] font-mono-plate text-lg font-bold uppercase focus-visible:ring-0 focus-visible:border-[#002FA7]";

const emptyFor = (user, mode) => ({
  owner_name: mode === "guest" ? "" : user?.owner_name || "",
  phone: mode === "guest" ? "" : user?.phone || "",
  flat_number: user?.flat_number || "",
  vehicle_number: "",
});

export const VehicleForm = ({ initial, mode = "member", onSuccess, onCancel }) => {
  const { user } = useAuth();
  const [form, setForm] = useState(emptyFor(user, mode));
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial?.id);
  const isGuest = isEdit ? Boolean(initial?.is_guest) : mode === "guest";

  useEffect(() => {
    if (initial) {
      setForm({
        owner_name: initial.owner_name || "",
        phone: initial.phone || "",
        flat_number: initial.flat_number || "",
        vehicle_number: initial.vehicle_number || "",
      });
    } else {
      setForm(emptyFor(user, mode));
    }
  }, [initial, user, mode]);

  const update = (key) => (e) => {
    const raw = e.target.value;
    const val =
      key === "vehicle_number" || key === "flat_number" ? raw.toUpperCase() : raw;
    setForm((f) => ({ ...f, [key]: val }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (
      !form.owner_name.trim() ||
      !form.phone.trim() ||
      !form.flat_number.trim() ||
      !form.vehicle_number.trim()
    ) {
      toast.error("Please fill all fields");
      return;
    }
    setSaving(true);
    try {
      if (isEdit) {
        const updated = await updateVehicle(initial.id, form);
        toast.success("Vehicle updated");
        onSuccess?.(updated);
      } else {
        const created = await createVehicle({ ...form, is_guest: mode === "guest" });
        toast.success(mode === "guest" ? "Guest vehicle added" : "Vehicle added");
        onSuccess?.(created);
      }
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const flatLocked = !isEdit && mode === "member" && !user?.is_admin;

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="vehicle-form">
      <div className="space-y-2">
        <Label htmlFor="owner_name" className="label-eyebrow">
          {isGuest ? "Guest Name" : "Owner Name"}
        </Label>
        <Input
          id="owner_name"
          data-testid="input-owner-name"
          value={form.owner_name}
          onChange={update("owner_name")}
          placeholder={isGuest ? "e.g. Anil (visitor)" : "e.g. Rakesh Sharma"}
          className={inputCls}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="label-eyebrow">
          {isGuest ? "Guest Phone" : "Phone Number"}
        </Label>
        <Input
          id="phone"
          data-testid="input-phone"
          value={form.phone}
          onChange={update("phone")}
          inputMode="tel"
          placeholder="+91 98765 43210"
          className={inputCls}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="flat_number" className="label-eyebrow">
          {isGuest ? "Visiting Flat" : "Flat / Apartment"}
        </Label>
        <Input
          id="flat_number"
          data-testid="input-flat-number"
          value={form.flat_number}
          onChange={update("flat_number")}
          placeholder="e.g. 402"
          disabled={flatLocked}
          className={
            inputCls +
            " font-mono-plate uppercase tracking-wide " +
            (flatLocked ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "")
          }
        />
        {flatLocked && (
          <p className="text-xs text-gray-500">Members can only add vehicles for their own flat.</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="vehicle_number" className="label-eyebrow">Vehicle Number</Label>
        <Input
          id="vehicle_number"
          data-testid="input-vehicle-number"
          value={form.vehicle_number}
          onChange={update("vehicle_number")}
          placeholder="MH 01 AB 1234"
          className={plateCls}
        />
      </div>

      <div className="flex gap-3 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            data-testid="cancel-vehicle-btn"
            onClick={onCancel}
            className="flex-1 h-12 rounded-sm border-black border-[1.5px] bg-white text-black hover:bg-gray-100 btn-brutalist font-semibold"
          >
            Cancel
          </Button>
        )}
        <Button
          type="submit"
          disabled={saving}
          data-testid="submit-vehicle-btn"
          className="flex-1 h-12 rounded-sm bg-[#002FA7] text-white hover:bg-[#0033b3] btn-brutalist font-semibold"
        >
          {saving ? "Saving..." : isEdit ? "Update" : isGuest ? "Add Guest" : "Add Vehicle"}
        </Button>
      </div>
    </form>
  );
};

export default VehicleForm;
