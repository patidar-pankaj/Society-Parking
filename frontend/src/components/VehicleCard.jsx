import { Phone, Home, User, Pencil, Trash2, UserCheck } from "lucide-react";

export const VehicleCard = ({ vehicle, canEdit, isMine, onEdit, onDelete, index = 0 }) => {
  const cleanPhone = (vehicle.phone || "").replace(/[^\d+]/g, "");
  const telHref = `tel:${cleanPhone}`;

  const handleCall = (e) => {
    e.stopPropagation();
    try {
      window.location.href = telHref;
    } catch (_) {
      // fallback: default anchor behavior
    }
  };

  const badges = (
    <>
      {vehicle.is_guest && (
        <span
          className="text-[0.6rem] tracking-[0.2em] font-bold uppercase bg-[#FFD700] text-black px-2 py-1 rounded-sm border-[1.5px] border-black"
          data-testid={`guest-badge-${vehicle.id}`}
        >
          Guest
        </span>
      )}
      {isMine && (
        <span
          className="text-[0.6rem] tracking-[0.2em] font-bold uppercase bg-[#002FA7] text-white px-2 py-1 rounded-sm"
          data-testid={`owned-badge-${vehicle.id}`}
        >
          You
        </span>
      )}
    </>
  );

  return (
    <div
      className="card-flat p-4 sm:p-5 fade-up"
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      data-testid={`vehicle-card-${vehicle.id}`}
    >
      <div className="flex items-stretch gap-3 mb-4">
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="plate-badge text-base" data-testid={`plate-${vehicle.id}`}>
              {vehicle.vehicle_number}
            </div>
            {badges}
          </div>

          <div className="space-y-1.5 mt-3">
            <div className="flex items-center gap-2 text-sm">
              {vehicle.is_guest ? (
                <UserCheck className="w-4 h-4 text-gray-500 shrink-0" />
              ) : (
                <User className="w-4 h-4 text-gray-500 shrink-0" />
              )}
              <span
                className="font-semibold text-black truncate"
                data-testid={`owner-${vehicle.id}`}
              >
                {vehicle.owner_name}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Home className="w-4 h-4 text-gray-500 shrink-0" />
              <span
                className="font-medium text-gray-700 truncate"
                data-testid={`flat-${vehicle.id}`}
              >
                {vehicle.is_guest ? "Visiting " : ""}Flat {vehicle.flat_number}
              </span>
            </div>
          </div>
        </div>

        {vehicle.photo && (
          <div className="shrink-0 w-28">
            <img
              src={vehicle.photo}
              alt={`Vehicle ${vehicle.vehicle_number}`}
              className="w-28 h-full min-h-[88px] object-cover rounded-sm border-[1.5px] border-black shadow-[2px_2px_0_0_#0a0a0a]"
              data-testid={`photo-${vehicle.id}`}
              loading="lazy"
            />
          </div>
        )}
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
          <span>{vehicle.phone}</span>
        </a>

        {canEdit && (
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
