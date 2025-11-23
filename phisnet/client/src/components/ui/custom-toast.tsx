import { toast as baseToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Info } from "lucide-react";

interface CustomToastProps {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
  duration?: number;
}

// Custom toast content component
const ToastContent = ({
  title,
  description,
  variant = "default"
}: {
  title: string;
  description?: string;
  variant?: "default" | "destructive";
}) => (
  <div className={`rounded-md w-full p-4 flex flex-col gap-1 
    ${variant === "destructive" ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"}`}
  >
    <div className="flex items-center gap-2">
      {variant === "destructive" ? (
        <XCircle className="h-5 w-5 shrink-0" />
      ) : (
        <CheckCircle className="h-5 w-5 shrink-0" />
      )}
      <div>
        <div className="font-semibold">{title}</div>
        {description && (
          <div className="text-sm mt-1 opacity-90">{description}</div>
        )}
      </div>
    </div>
  </div>
);

// A set of helper functions that don't use React hooks directly
export const customToast = {
  // Show a success toast
  success: (props: Omit<CustomToastProps, "variant">) => {
    return baseToast({
      description: <ToastContent {...props} variant="default" />,
      duration: props.duration || 3000,
    });
  },
  
  // Show an error toast
  error: (props: Omit<CustomToastProps, "variant">) => {
    return baseToast({
      description: <ToastContent {...props} variant="destructive" />,
      duration: props.duration || 5000,
    });
  },

  // Informational (neutral) toast
  info: (props: Omit<CustomToastProps, "variant">) => {
    return baseToast({
      description: (
        <div className="rounded-md w-full p-4 flex flex-col gap-1 bg-muted text-muted-foreground">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 shrink-0" />
            <div>
              <div className="font-semibold">{props.title}</div>
              {props.description && (
                <div className="text-sm mt-1 opacity-90">{props.description}</div>
              )}
            </div>
          </div>
        </div>
      ),
      duration: props.duration || 4000,
    });
  }
};