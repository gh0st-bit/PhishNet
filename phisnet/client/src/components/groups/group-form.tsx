import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2 } from "lucide-react";

const groupSchema = z.object({
  name: z.string().min(1, "Group name is required"),
  description: z.string().optional(),
});

type GroupFormValues = z.infer<typeof groupSchema>;

interface GroupFormProps {
  group?: any;
  onClose: () => void;
}

export default function GroupForm({ group, onClose }: GroupFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const form = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    defaultValues: group ? {
      name: group.name,
      description: group.description || "",
    } : {
      name: "",
      description: "",
    },
  });

  const isEditing = !!group;

  const mutation = useMutation({
    mutationFn: async (data: GroupFormValues) => {
      const url = isEditing 
        ? `/api/groups/${group.id}` 
        : "/api/groups";
      const method = isEditing ? "PUT" : "POST";
      const res = await apiRequest(method, url, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: `Group ${isEditing ? 'updated' : 'created'}`,
        description: `Your target group has been ${isEditing ? 'updated' : 'created'} successfully.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: `Error ${isEditing ? 'updating' : 'creating'} group`,
        description: error.message,
        variant: "destructive",
      });
    },
  });

  function onSubmit(data: GroupFormValues) {
    mutation.mutate(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Group Name</FormLabel>
              <FormControl>
                <Input placeholder="Enter group name" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Enter group description" 
                  className="resize-none h-24" 
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-3">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? "Updating..." : "Creating..."}
              </>
            ) : (
              isEditing ? "Update Group" : "Create Group"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}


// PhishNet/phisnet/client/src/components/groups/group-form.tsx


// The above code defines a React component for creating and editing groups using React Hook Form and Zod for validation. It includes form fields for the group name and description, handles form submission with React Query mutations, and provides user feedback through toast notifications.


// The component accepts optional group data for editing and a callback function to close the form.


// It uses a schema defined with Zod to validate the form inputs, ensuring that the group name is provided.


// The form submission logic differentiates between creating a new group and updating an existing one based on the presence of group data.


// The component also manages loading states and error handling during the mutation process, providing a smooth user experience.


// The UI elements are built using custom components for form controls, inputs, buttons, and text areas, ensuring a consistent design across the application.


// The component is styled with utility classes for layout and spacing, making it visually appealing and user-friendly.


// Overall, this component encapsulates the functionality needed to manage group data effectively within the PhishNet application.


// End of PhishNet/phisnet/client/src/components/groups/group-form.tsx


//import { zodResolver } from "@hookform/resolvers/zod";
//import { useForm } from "react-hook-form";
//import { z } from "zod";
//import { useMutation, useQueryClient } from "@tanstack/react-query";
//import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
//import { Input } from "@/components/ui/input";
//import { Button } from "@/components/ui/button";
//import { Textarea } from "@/components/ui/textarea";
//import { useToast } from "@/hooks/use-toast";
//import { apiRequest } from "@/lib/queryClient";
//import { Loader2 } from "lucide-react";

//const groupSchema = z.object({
  //name: z.string().min(1, "Group name is required"),
  //description: z.string().optional(),
//});

//type GroupFormValues = z.infer<typeof groupSchema>;

//interface GroupFormProps {
  //group?: any;
  //onClose: () => void;
//}

//export default function GroupForm({ group, onClose }: GroupFormProps) {
  //const { toast } = useToast();
  //const queryClient = useQueryClient();
  
  //const form = useForm<GroupFormValues>({
    //resolver: zodResolver(groupSchema),
    //defaultValues: group ? {
      //name: group.name,
      //description: group.description || "",
    //} : {
      //name: "",
      //description: "",
    //},
  //});

  //const isEditing = !!group;

  //const mutation = useMutation({
    //mutationFn: async (data: GroupFormValues) => {
      //const url = isEditing 
        //? `/api/groups/${group.id}` 
        //: "/api/groups";
      //const method = isEditing ? "PUT" : "POST";
      //const res = await apiRequest(method, url, data);
      //return await res.json();
    //},
    //onSuccess: () => {
      //toast({
        //title: `Group ${isEditing ? 'updated' : 'created'}`,
        //description: `Your target group has been ${isEditing ? 'updated' : 'created'} successfully.`,
      //});
      //queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      //onClose();
    //},
    //onError: (error) => {
      //toast({
        //title: `Error ${isEditing ? 'updating' : 'creating'} group`,
        //description: error.message,
        ///variant: "destructive",
      //});
    //},
  //});

  //function onSubmit(data: GroupFormValues) {
    //mutation.mutate(data);
  //}

  //return (
    //<Form {...form}>
      //<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        //<FormField
          //control={form.control}
          //name="name"
          //render={({ field }) => (
            //<FormItem>
              //<FormLabel>Group Name</FormLabel>
              //<FormControl>
                //<Input placeholder="Enter group name" {...field} />
              //</FormControl>
              //<FormMessage />
            //</FormItem>
          //)}
        ///>
        
        //<FormField
          //control={form.control}
          //name="description"
          //render={({ field }) => (
            //<FormItem>
              //<FormLabel>Description (Optional)</FormLabel>
              //<FormControl>
                //<Textarea 
                 // placeholder="Enter group description" 
                 // className="resize-none h-24" 
                 // {...field} 
                //>
              //</FormControl>
              //<FormMessage />
            //</FormItem>
          //)}
        //>

        //<div className="flex justify-end space-x-3">
          //<Button variant="outline" type="button" onClick={onClose}>
            //Cancel
          //</Button>
          //<Button type="submit" disabled={mutation.isPending}>
            //{mutation.isPending ? (
              //<>
                //<Loader2 className="mr-2 h-4 w-4 animate-spin" />
                //{isEditing ? "Updating..." : "Creating..."}
             // </>
            //) : (
              //isEditing ? "Update Group" : "Create Group"
            //)}
          //</Button>
        //</div>
      //</form>
    //</Form>
  //);
//}
