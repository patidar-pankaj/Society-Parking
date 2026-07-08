import { useState, useEffect } from "react";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import { toast } from "sonner";
import { createVehicle, updateVehicle } from "../lib/api";

const EMPTY = { owner_name: "", phone: "", flat_number: "", vehicle_number: "" };

export const VehicleForm = ({ initial, onSuccess, onCancel }) => {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const isEdit = Boolean(initial?.id);

  useEffect(() => {
    if (initial) {
      setForm({
        owner_name: initial.owner_name || "",
        phone: initial.phone || "",
        flat_number: initial.flat_number || "",
        vehicle_number: initial.vehicle_number || "",
      });
    } else {
      setForm(EMPTY);
    }
  }, [initial]);

  const update = (key) => (e) => {
    const raw = e.target.value;
    const val =
      key === "vehicle_number" || key === "flat_number" ? raw.toUpperCase() : raw;
    setForm((f) => ({ ...f, [key]: val }));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.owner_name.trim() || !form.phone.trim() || !form.flat_number.trim() || !form.vehicle_number.trim()) {
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
        const created = await createVehicle(form);
        toast.success("Vehicle added");
        // Save ownership locally so user can identify their entries
        const owned = JSON.parse(localStorage.getItem("ssp_owned") || "[]");
        if (!owned.includes(created.id)) {
          owned.push(created.id);
          localStorage.setItem("ssp_owned", JSON.stringify(owned));
        }
        onSuccess?.(created);
      }
    } catch (err) {
      const msg = err?.response?.data?.detail || "Something went wrong";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-5" data-testid="vehicle-form">
      <div className="space-y-2">
        <Label htmlFor="owner_name" className="label-eyebrow">Owner Name</Label>
        <Input
          id="owner_name"
          data-testid="input-owner-name"
          value={form.owner_name}
          onChange={update("owner_name")}
          placeholder="e.g. Rakesh Sharma"
          className="h-12 border-black border-[1.5px] rounded-sm bg-white text-base font-medium focus-visible:ring-0 focus-visible:border-[#002FA7]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="phone" className="label-eyebrow">Phone Number</Label>
        <Input
          id="phone"
          data-testid="input-phone"
          value={form.phone}
          onChange={update("phone")}
          inputMode="tel"
          placeholder="e.g. +91 98765 43210"
          className="h-12 border-black border-[1.5px] rounded-sm bg-white text-base font-medium focus-visible:ring-0 focus-visible:border-[#002FA7]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="flat_number" className="label-eyebrow">Flat / Apartment</Label>
        <Input
          id="flat_number"
          data-testid="input-flat-number"
          value={form.flat_number}
          onChange={update("flat_number")}
          placeholder="e.g. B-402"
          className="h-12 border-black border-[1.5px] rounded-sm bg-white text-base font-semibold uppercase tracking-wide focus-visible:ring-0 focus-visible:border-[#002FA7]"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vehicle_number" className="label-eyebrow">Vehicle Number</Label>
        <Input
          id="vehicle_number"
          data-testid="input-vehicle-number"
          value={form.vehicle_number}
          onChange={update("vehicle_number")}
          placeholder="MH 01 AB 1234"
          className="h-14 border-black border-[1.5px] rounded-sm bg-[#fef7cd] font-mono-plate text-lg font-bold uppercase focus-visible:ring-0 focus-visible:border-[#002FA7]"
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
          {saving ? "Saving..." : isEdit ? "Update" : "Add Vehicle"}
        </Button>
      </div>
    </form>
  );
};

export default VehicleForm;
