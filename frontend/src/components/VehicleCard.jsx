import { Phone, Home, User, Pencil, Trash2 } from "lucide-react";
import { Button } from "./ui/button";

export const VehicleCard = ({ vehicle, isOwned, onEdit, onDelete, index = 0 }) => {
  const cleanPhone = (vehicle.phone || "").replace(/[^\d+]/g, "");
  const telHref = `tel:${cleanPhone}`;

  const handleCall = (e) => {
    // Ensure dialer opens even if the default anchor navigation is blocked
    // by preview iframes, service workers, or handlers on parent elements.
    e.stopPropagation();
    try {
      window.location.href = telHref;
    } catch (_) {
      // fall back to default anchor behaviour
    }
  };

  return (
    <div
      className="card-flat p-4 sm:p-5 fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      data-testid={`vehicle-card-${vehicle.id}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="plate-badge text-base" data-testid={`plate-${vehicle.id}`}>
          {vehicle.vehicle_number}
        </div>
        {isOwned && (
          <span
            className="text-[0.6rem] tracking-[0.2em] font-bold uppercase bg-[#002FA7] text-white px-2 py-1 rounded-sm"
            data-testid={`owned-badge-${vehicle.id}`}
          >
            You
          </span>
        )}
      </div>

      <div className="space-y-1.5 mb-4">
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-gray-500" />
          <span className="font-semibold text-black" data-testid={`owner-${vehicle.id}`}>
            {vehicle.owner_name}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Home className="w-4 h-4 text-gray-500" />
          <span className="font-medium text-gray-700" data-testid={`flat-${vehicle.id}`}>
            Flat {vehicle.flat_number}
          </span>
        </div>
      </div>

      <div className="flex gap-2">
        <a
          href={telHref}
          onClick={handleCall}
          data-testid={`call-btn-${vehicle.id}`}
          data-phone={cleanPhone}
          className="flex-1 inline-flex items-center justify-center gap-2 h-14 rounded-sm bg-[#16A34A] text-white font-bold text-base btn-brutalist hover:bg-[#15803d] active:scale-[0.98]"
        >
          <Phone className="w-5 h-5" strokeWidth={2.5} />
          <span>Call {vehicle.phone}</span>
        </a>

        {isOwned && (
          <>
            <button
              type="button"
              onClick={() => onEdit?.(vehicle)}
              data-testid={`edit-btn-${vehicle.id}`}
              className="h-14 w-14 flex items-center justify-center rounded-sm bg-white border-[1.5px] border-black btn-brutalist hover:bg-gray-100"
              aria-label="Edit vehicle"
            >
              <Pencil className="w-5 h-5 text-black" />
            </button>
            <button
              type="button"
              onClick={() => onDelete?.(vehicle)}
              data-testid={`delete-btn-${vehicle.id}`}
              className="h-14 w-14 flex items-center justify-center rounded-sm bg-[#FF3333] border-[1.5px] border-black btn-brutalist hover:bg-[#e02929]"
              aria-label="Delete vehicle"
            >
              <Trash2 className="w-5 h-5 text-white" />
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default VehicleCard;
