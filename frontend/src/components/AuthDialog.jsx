import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Button } from "./ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";
import { VALID_FLATS, formatApiErrorDetail } from "../lib/api";
import { normalizePhone } from "../lib/phone";

const inputCls =
  "h-12 border-black border-[1.5px] rounded-sm bg-white text-base font-medium focus-visible:ring-0 focus-visible:border-[#002FA7]";
const plateCls =
  "h-12 border-black border-[1.5px] rounded-sm bg-[#fef7cd] font-mono-plate text-base font-bold uppercase focus-visible:ring-0 focus-visible:border-[#002FA7]";

const flatsByFloor = [1, 2, 3, 4, 5].map((floor) => ({
  floor,
  flats: VALID_FLATS.filter((f) => f.startsWith(String(floor))),
}));

export const AuthDialog = ({ open, onOpenChange, defaultTab = "login" }) => {
  const { login, signup } = useAuth();
  const [tab, setTab] = useState(defaultTab);

  useEffect(() => {
    if (open) setTab(defaultTab);
  }, [defaultTab, open]);

  const [loginFlat, setLoginFlat] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginBusy, setLoginBusy] = useState(false);

  const [su, setSu] = useState({
    owner_name: "",
    phone: "",
    flat_number: "",
    vehicle_number: "",
    password: "",
    confirm_password: "",
  });
  const [suBusy, setSuBusy] = useState(false);

  const doLogin = async (e) => {
    e.preventDefault();
    if (!loginFlat.trim() || !loginPassword) {
      toast.error("Enter flat number and password");
      return;
    }
    setLoginBusy(true);
    try {
      const user = await login({
        flat_number: loginFlat.trim().toUpperCase(),
        password: loginPassword,
      });
      toast.success(`Welcome back, Flat ${user.flat_number}`);
      onOpenChange(false);
      setLoginFlat("");
      setLoginPassword("");
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Login failed");
    } finally {
      setLoginBusy(false);
    }
  };

  const doSignup = async (e) => {
    e.preventDefault();
    for (const [k, v] of Object.entries(su)) {
      if (!String(v).trim()) {
        toast.error("Please fill all fields");
        return;
      }
    }
    if (su.password !== su.confirm_password) {
      toast.error("Passwords do not match");
      return;
    }
    if (su.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    const tenDigit = normalizePhone(su.phone);
    if (!tenDigit) {
      toast.error("Phone must be a 10-digit Indian mobile number");
      return;
    }
    setSuBusy(true);
    try {
      const user = await signup({
        owner_name: su.owner_name.trim(),
        phone: `+91 ${tenDigit.slice(0, 5)} ${tenDigit.slice(5)}`,
        flat_number: su.flat_number.trim().toUpperCase(),
        vehicle_number: su.vehicle_number.trim().toUpperCase(),
        password: su.password,
        confirm_password: su.confirm_password,
      });
      toast.success(`Registered Flat ${user.flat_number}`);
      onOpenChange(false);
      setSu({
        owner_name: "",
        phone: "",
        flat_number: "",
        vehicle_number: "",
        password: "",
        confirm_password: "",
      });
    } catch (err) {
      toast.error(formatApiErrorDetail(err?.response?.data?.detail) || "Sign up failed");
    } finally {
      setSuBusy(false);
    }
  };

  const upd = (k) => (e) => {
    const raw = e.target.value;
    const v = k === "vehicle_number" ? raw.toUpperCase() : raw;
    setSu((s) => ({ ...s, [k]: v }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="auth-dialog"
        className="max-w-md rounded-sm border-[1.5px] border-black bg-white p-6 max-h-[92vh] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle className="font-heading text-2xl font-black">
            {tab === "login" ? "Welcome back" : "Register your flat"}
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {tab === "login"
              ? "Sign in with your flat number and password."
              : "One-time registration per flat. You'll be signed in automatically."}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="grid grid-cols-2 w-full bg-[#efeae1] border-[1.5px] border-black rounded-sm p-0 h-11">
            <TabsTrigger
              value="login"
              data-testid="auth-tab-login"
              className="rounded-none data-[state=active]:bg-black data-[state=active]:text-[#fef7cd] font-bold uppercase tracking-widest text-xs"
            >
              Sign In
            </TabsTrigger>
            <TabsTrigger
              value="signup"
              data-testid="auth-tab-signup"
              className="rounded-none data-[state=active]:bg-black data-[state=active]:text-[#fef7cd] font-bold uppercase tracking-widest text-xs"
            >
              Sign Up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="mt-5">
            <form onSubmit={doLogin} className="space-y-4" data-testid="login-form">
              <div className="space-y-2">
                <Label className="label-eyebrow">Flat Number</Label>
                <Input
                  data-testid="login-flat"
                  value={loginFlat}
                  onChange={(e) => setLoginFlat(e.target.value.toUpperCase())}
                  placeholder="e.g. 302"
                  className={plateCls + " text-center tracking-widest"}
                />
              </div>
              <div className="space-y-2">
                <Label className="label-eyebrow">Password</Label>
                <Input
                  type="password"
                  data-testid="login-password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="Your password"
                  className={inputCls}
                />
              </div>
              <Button
                type="submit"
                disabled={loginBusy}
                data-testid="login-submit"
                className="w-full h-12 rounded-sm bg-[#002FA7] text-white hover:bg-[#0033b3] btn-brutalist font-semibold"
              >
                {loginBusy ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="mt-5">
            <form onSubmit={doSignup} className="space-y-4" data-testid="signup-form">
              <div className="space-y-2">
                <Label className="label-eyebrow">Your Name</Label>
                <Input
                  data-testid="signup-name"
                  value={su.owner_name}
                  onChange={upd("owner_name")}
                  placeholder="e.g. Rakesh Sharma"
                  className={inputCls}
                />
              </div>
              <div className="space-y-2">
                <Label className="label-eyebrow">Phone Number</Label>
                <Input
                  data-testid="signup-phone"
                  value={su.phone}
                  onChange={upd("phone")}
                  inputMode="tel"
                  maxLength={20}
                  placeholder="10-digit mobile, e.g. 9876543210"
                  className={inputCls}
                />
              </div>
              <div className="space-y-2">
                <Label className="label-eyebrow">Flat Number *</Label>
                <Select
                  value={su.flat_number}
                  onValueChange={(v) => setSu((s) => ({ ...s, flat_number: v }))}
                >
                  <SelectTrigger
                    data-testid="signup-flat"
                    className="h-12 border-black border-[1.5px] rounded-sm bg-white font-mono-plate text-base font-bold uppercase focus:ring-0"
                  >
                    <SelectValue placeholder="Select your flat" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] rounded-sm border-[1.5px] border-black">
                    {flatsByFloor.map(({ floor, flats }) => (
                      <SelectGroup key={floor}>
                        <SelectLabel className="label-eyebrow">Floor {floor}</SelectLabel>
                        {flats.map((f) => (
                          <SelectItem
                            key={f}
                            value={f}
                            data-testid={`flat-option-${f}`}
                            className="font-mono-plate font-semibold"
                          >
                            {f}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="label-eyebrow">Vehicle Number *</Label>
                <Input
                  data-testid="signup-vehicle"
                  value={su.vehicle_number}
                  onChange={upd("vehicle_number")}
                  placeholder="MH 01 AB 1234"
                  className={plateCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="label-eyebrow">Password *</Label>
                  <Input
                    type="password"
                    data-testid="signup-password"
                    value={su.password}
                    onChange={upd("password")}
                    placeholder="min 6 chars"
                    className={inputCls}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="label-eyebrow">Confirm *</Label>
                  <Input
                    type="password"
                    data-testid="signup-confirm"
                    value={su.confirm_password}
                    onChange={upd("confirm_password")}
                    placeholder="repeat"
                    className={inputCls}
                  />
                </div>
              </div>
              <Button
                type="submit"
                disabled={suBusy}
                data-testid="signup-submit"
                className="w-full h-12 rounded-sm bg-[#002FA7] text-white hover:bg-[#0033b3] btn-brutalist font-semibold"
              >
                {suBusy ? "Creating account..." : "Sign Up & Add Vehicle"}
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default AuthDialog;
