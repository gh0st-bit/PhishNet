import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Loader2, FileUp, AlertCircle, CheckCircle2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
//import { Input } from "@/components/ui/input";
const importSchema = z.object({
  file: z.any()
    .refine((file) => file && file.size > 0, {
      message: "CSV file is required",
    })
    .refine((file) => file && (file.type === "text/csv" || file.name.endsWith(".csv")), {
      message: "File must be a CSV",
    }),
});
// type definitions
type ImportFormValues = z.infer<typeof importSchema>;
// component props
interface ImportCSVProps {
  groupId: number;
  onClose: () => void;
}
// component
export default function ImportCSV({ groupId, onClose }: ImportCSVProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState<any[]>([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  // form setup 
  const form = useForm<ImportFormValues>({
    resolver: zodResolver(importSchema),
    defaultValues: {
      file: undefined,
    },
  });
  // handle file input change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      form.setValue("file", file);
      
      // Read and preview the CSV
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const text = event.target?.result as string;
          const lines = text.split("\n").filter(line => line.trim());
          const headers = lines[0].split(",").map(h => h.trim());
          // Validate required columns
          if (!headers.includes("email") || 
              !headers.includes("firstName") && !headers.includes("first_name") && !headers.includes("firstname")) {
            toast({
              title: "Invalid CSV format",
              description: "CSV must include at least 'email' and 'firstName' columns",
              variant: "destructive",
            });
            return;
          }
          // Generate preview data
          const previewData: Record<string, string>[] = [];
          for (let i = 1; i < Math.min(lines.length, 6); i++) {
            const values = lines[i].split(",").map(v => v.trim());
            const row: Record<string, string> = {};
            headers.forEach((header, index) => {
              row[header] = values[index] || '';
            });
            previewData.push(row);
          }
          // Set preview state
          setPreview(previewData);
        } catch (error) {
          toast({
            title: "Error parsing CSV",
            description: "Could not parse the CSV file. Please check the format.",
            variant: "destructive",
          });
        }
      };
      reader.readAsText(file);
    }
  };
  // mutation for file upload
  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const res = await fetch(`/api/groups/${groupId}/import`, {
        method: "POST",
        body: data,
        credentials: "include",
      });
      // Handle non-2xx responses
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || res.statusText);
      }
      
      return await res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Import successful",
        description: `${data.imported} targets imported successfully`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/groups', groupId, 'targets'] });
      queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Import failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  // form submission handler
  function onSubmit(formData: ImportFormValues) {
    // Simulate progress for better UX
    let progress = 0;
    const interval = setInterval(() => {
      progress += 5;
      if (progress > 95) {
        clearInterval(interval);
      } else {
        setUploadProgress(progress);
      }
    }, 100);
    // Prepare form data
    const data = new FormData();
    data.append("file", formData.file);
    // Trigger mutation
    mutation.mutate(data);
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="file"
          render={({ field: { value, onChange, ...fieldProps } }) => (
            <FormItem>
              <FormLabel>CSV File</FormLabel>
              <FormControl>
                <div className="flex flex-col items-center justify-center w-full">
                  <label 
                    htmlFor="csv-upload" 
                    className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer border-border hover:bg-secondary/30"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <FileUp className="w-8 h-8 mb-2 text-muted-foreground" />
                      <p className="mb-2 text-sm text-muted-foreground">
                        <span className="font-semibold">Click to upload</span> or drag and drop
                      </p>
                      <p className="text-xs text-muted-foreground">CSV file with target data</p>
                    </div>
                    <input 
                      id="csv-upload" 
                      type="file" 
                      accept=".csv" 
                      className="hidden" 
                      onChange={(e) => {
                        handleFileChange(e);
                        onChange(e.target.files?.[0]); // Required for form validation
                      }}
                      {...fieldProps}
                    />
                  </label>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        
        {preview.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Preview (first 5 rows)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    {Object.keys(preview[0]).map((header, i) => (
                      <th key={i} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.map((row, i) => (
                    <tr key={i} className="border-b border-border">
                      {Object.values(row).map((value, j) => (
                        <td key={j} className="px-3 py-2">
                          {value as string}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>CSV Format Requirements</AlertTitle>
              <AlertDescription>
                CSV must include 'email' and 'firstName' or 'first_name' columns. 
                Additional supported columns: lastName/last_name, position/title, department.
              </AlertDescription>
            </Alert>
          </div>
        )}
        
        {mutation.isPending && (
          <div className="space-y-2">
            <Progress value={uploadProgress} className="h-2" />
            <p className="text-sm text-muted-foreground text-center">
              Importing targets... {uploadProgress}%
            </p>
          </div>
        )}

        <div className="flex justify-end space-x-3">
          <Button variant="outline" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={mutation.isPending || preview.length === 0}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              "Import Targets"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}












//
//import { useState } from "react";
//import { zodResolver } from "@hookform/resolvers/zod";
//import { useForm } from "react-hook-form";
//import { z } from "zod";
//import { useMutation, useQueryClient } from "@tanstack/react-query";
//import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
//import { Button } from "@/components/ui/button";
//import { useToast } from "@/hooks/use-toast";
//import { apiRequest } from "@/lib/queryClient";
//import { Loader2, FileUp, AlertCircle, CheckCircle2 } from "lucide-react";
//import { Progress } from "@/components/ui/progress";
//import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
//import { Input } from "@/components/ui/input";
//const importSchema = z.object({
//  file: z.any()
  //  .refine((file) => file && file.size > 0, {
    //  message: "CSV file is required",
    //})
    //.refine((file) => file && (file.type === "text/csv" || file.name.endsWith(".csv")), {
      //message: "File must be a CSV",
    //}),
//});
// type definitions
//type ImportFormValues = z.infer<typeof importSchema>;
// component props
//interface ImportCSVProps {
  //groupId: number;
  //onClose: () => void;
}
// component
//export default function ImportCSV({ groupId, onClose }: ImportCSVProps) {
  //const { toast } = useToast();
  //const queryClient = useQueryClient();
  //const [preview, setPreview] = useState<any[]>([]);
  //const [uploadProgress, setUploadProgress] = useState(0);
  // form setup 
  //const form = useForm<ImportFormValues>({
    //resolver: zodResolver(importSchema),
    //defaultValues: {
      //file: undefined,
    //},
  //});
  // handle file input change
  //const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    //const file = e.target.files?.[0];
    //if (file) {
      //form.setValue("file", file);
      
      // Read and preview the CSV
      //const reader = new FileReader();
      //reader.onload = (event) => {
        //try {
          //const text = event.target?.result as string;
          //const lines = text.split("\n").filter(line => line.trim());
          //const headers = lines[0].split(",").map(h => h.trim());
          // Validate required columns
          //if (!headers.includes("email") || 
            //  !headers.includes("firstName") && !headers.includes("first_name") && !headers.includes("firstname")) {
            //toast({
              //title: "Invalid CSV format",
              //description: "CSV must include at least 'email' and 'firstName' columns",
              //variant: "destructive",
            //});
            //return;
          //}
          // Generate preview data
          //const previewData: Record<string, string>[] = [];
          //for (let i = 1; i < Math.min(lines.length, 6); i++) {
            //const values = lines[i].split(",").map(v => v.trim());
            //const row: Record<string, string> = {};
            //headers.forEach((header, index) => {
              //row[header] = values[index] || '';
            //});
            //previewData.push(row);
          //}
          // Set preview state
          //setPreview(previewData);
        //} catch (error) {
          //toast({
            //title: "Error parsing CSV",
            //description: "Could not parse the CSV file. Please check the format.",
            //variant: "destructive",
          //});
        //}
      //};
     // reader.readAsText(file);
    //}
  //};
  // mutation for file upload
  //const mutation = useMutation({
    //mutationFn: async (data: FormData) => {
      //const res = await fetch(`/api/groups/${groupId}/import`, {
        //method: "POST",
        //body: data,
        //credentials: "include",
      //});
      // Handle non-2xx responses
      //if (!res.ok) {
        //const text = await res.text();
        //throw new Error(text || res.statusText);
      //}
      
      //return await res.json();
    //},
    //onSuccess: (data) => {
      //toast({
        //title: "Import successful",
        //description: `${data.imported} targets imported successfully`,
      //});
      //queryClient.invalidateQueries({ queryKey: ['/api/groups', groupId, 'targets'] });
      //queryClient.invalidateQueries({ queryKey: ['/api/groups'] });
      //onClose();
    //},
    //onError: (error) => {
      //toast({
        //title: "Import failed",
        //description: error.message,
        //variant: "destructive",
      //});
    //},
   //});
  // form submission handler
  //function onSubmit(formData: ImportFormValues) {
    // Simulate progress for better UX
    //let progress = 0;
    //const interval = setInterval(() => {
      //progress += 5;
      //if (progress > 95) {
        //clearInterval(interval);
      //} else {
        //setUploadProgress(progress);
      //}
    //}, 100);
    // Prepare form data
    //const data = new FormData();
    //data.append("file", formData.file);
    // Trigger mutation
    //mutation.mutate(data);
  //}

  //return (
    //<Form {...form}>
      //<form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        //<FormField
          //control={form.control}
          //name="file"
          //render={({ field: { value, onChange, ...fieldProps } }) => (
            //<FormItem>
              //<FormLabel>CSV File</FormLabel>
              //<FormControl>
                //<div className="flex flex-col items-center justify-center w-full">
                  //<label 
                    //htmlFor="csv-upload" 
                    //className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer border-border hover:bg-secondary/30"
                  //>
                    //<div className="flex flex-col items-center justify-center pt-5 pb-6">
                      //<FileUp className="w-8 h-8 mb-2 text-muted-foreground" />
                      //<p className="mb-2 text-sm text-muted-foreground">
                        //<span className="font-semibold">Click to upload</span> or drag and drop
                      //</p>
                      //<p className="text-xs text-muted-foreground">CSV file with target data</p>
                    //</div>
                    //<input 
                      //id="csv-upload" 
                      //type="file" 
                      //accept=".csv" 
                      //className="hidden" 
                      //onChange={(e) => {
                        //handleFileChange(e);
                        //onChange(e.target.files?.[0]); // Required for form validation
                      //}}
                      //{...fieldProps}
                    ///>
                  //</label>
                //</div>
              //</FormControl>
              //<FormMessage />
            //</FormItem>
          //)}
        ///>
        
        //{preview.length > 0 && (
          //<div className="space-y-3">
            //<h3 className="text-sm font-medium">Preview (first 5 rows)</h3>
            //<div className="overflow-x-auto">
              //<table className="w-full text-sm border-collapse">
                //<thead>
                  //<tr className="border-b border-border">
                    //{Object.keys(preview[0]).map((header, i) => (
                      //<th key={i} className="px-3 py-2 text-left text-xs font-medium text-muted-foreground">
                        //{header}
                      //</th>
                    //))}
                  //</tr>
                //</thead>
                //<tbody>
                  //{preview.map((row, i) => (
                    //<tr key={i} className="border-b border-border">
                      //{Object.values(row).map((value, j) => (
                        //<td key={j} className="px-3 py-2">
                          //{value as string}
                        //</td>
                      //))}
                    //</tr>
                   //))}
                ///</tbody>
              //</table>
            //</div>
            
            //<Alert>
              //<AlertCircle className="h-4 w-4" />
              //<AlertTitle>CSV Format Requirements</AlertTitle>
              //<AlertDescription>
                //CSV must include 'email' and 'firstName' or 'first_name' columns. 
                //Additional supported columns: lastName/last_name, position/title, department.
              //</AlertDescription>
            //</Alert>
          //</div>
        //)}
        
        //{mutation.isPending && (
          //<div className="space-y-2">
            //<Progress value={uploadProgress} className="h-2" />
            //<p className="text-sm text-muted-foreground text-center">
              //Importing targets... {uploadProgress}%
            //</p>
          //</div>
        //)}

        //<div className="flex justify-end space-x-3">
          //<Button variant="outline" type="button" onClick={onClose}>
            //Cancel
          //</Button>
          //<Button 
            //type="submit" 
            //disabled={mutation.isPending || preview.length === 0}
          //>
            //{mutation.isPending ? (
              //<>
                //<Loader2 className="mr-2 h-4 w-4 animate-spin" />
                //Importing...
              //</>
            //) : (
              //"Import Targets"
            //)}
          //</Button>
        //</div>
      //</form>
      //</Form>
  //);
//}

//x
//
//import { zodResolver } from "@hookform/resolvers/zod";
//import { useForm } from "react-hook-form";
//import { z } from "zod";
//import { useMutation, useQueryClient } from "@tanstack/react-query";
//import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
//import { Button } from "@/components/ui/button";
//import { useToast } from "@/hooks/use-toast";
//import { apiRequest } from "@/lib/queryClient";
//import { Loader2 } from "lucide-react";
//import { Input } from "@/components/ui/input";
//const groupFormSchema = z.object({
  //name: z.string().min(1, { message: "Group name is required" }),
  //description: z.string().optional(),
//});
// type definitions
//type GroupFormValues = z.infer<typeof groupFormSchema>;
// component props
//interface GroupFormProps {
  //group?: any;
  //onClose: () => void;
//}
// component
//export default function GroupForm({ group, onClose }: GroupFormProps) {
  //const { toast } = useToast();
  //const queryClient = useQueryClient();
  //const form = useForm<GroupFormValues>({
    //resolver: zodResolver(groupFormSchema),
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
  //});
  //function onSubmit(formData: GroupFormValues) {
    //mutation.mutate(formData);
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