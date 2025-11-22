import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/**
 * Type representing an individual user with risk metadata.
 */

interface RiskUser {
  id: number;
  name: string;
  department: string;
  riskLevel: "High Risk" | "Medium Risk" | "Low Risk";
  avatar?: string; // Optional custom avatar image
}

/**
 * Props for the AtRiskUsers component.
 */
interface AtRiskUsersProps {
  users?: RiskUser[];
}

/**
 * AtRiskUsers Component
 * ---------------------
 * Renders a list of users along with their risk levels.
 * Displays user initials when no avatar image is provided.
 */
export default function AtRiskUsers({ users }: AtRiskUsersProps) {

 /**
   * Returns a TailwindCSS color class based on the user's risk level.
   */

  const getRiskLevelColor = (level: string) => {
    switch(level) {
      case "High Risk": return "text-destructive";    // Red color for high risk
      case "Medium Risk": return "text-warning";      // Yellow color for medium risk
      case "Low Risk": return "text-success";         // Green color for low risk
      default: return "text-muted-foreground";
    }
  };

   /**
   * Extracts and returns initials from a user's full name.
   * - Uses first two words (e.g., "John Doe" → "JD")
   * - Falls back to first two letters if only one name is provided
   */
  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`;
    }
    return name.slice(0, 2).toUpperCase();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>At-Risk Users</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {users && users.length > 0 ? (
          users.map((user) => (
            <div key={user.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Avatar>
                  <AvatarFallback className="bg-secondary text-foreground">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h4 className="text-sm font-medium text-foreground">{user.name}</h4>
                  <p className="text-xs text-muted-foreground">{user.department}</p>
                </div>
              </div>
              <div className="flex items-center">
                <span className={`text-xs font-medium ${getRiskLevelColor(user.riskLevel)}`}>
                  {user.riskLevel}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="py-6 text-center text-muted-foreground">
            No at-risk users found
          </div>
        )}
      </CardContent>
    </Card>
  );
}
