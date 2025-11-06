import { useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Upload, Palette, Eye, Save, AlertCircle, CheckCircle2, Crown } from "lucide-react";

export default function BrandSettings() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [primaryColor, setPrimaryColor] = useState("#0066CC");
  const [secondaryColor, setSecondaryColor] = useState("#00CC66");
  const [isUploading, setIsUploading] = useState(false);

  // Fetch current branding settings
  const { data: brandingData, isLoading } = useQuery({
    queryKey: ['/api/tenants/branding'],
    enabled: !!user && user.tenant?.type === 'CONSULTANT'
  });

  // Update branding mutation
  const updateBrandingMutation = useMutation({
    mutationFn: async (data: {
      logoUrl?: string;
      brandColorPrimary?: string;
      brandColorSecondary?: string;
    }) => {
      const res = await apiRequest("PATCH", "/api/tenants/branding", data);
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to update branding');
      }
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Branding Updated",
        description: "Your white-label branding has been successfully updated.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/tenants/branding'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update branding. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Check if user is consultant
  if (user?.tenant?.type !== 'CONSULTANT') {
    return (
      <div className="container mx-auto px-4 py-12">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            White-label branding is only available for consultant accounts.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const handleLogoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please select an image file (PNG, JPG, or SVG).",
          variant: "destructive",
        });
        return;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Logo file must be less than 2MB.",
          variant: "destructive",
        });
        return;
      }

      setLogoFile(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadLogo = async () => {
    if (!logoFile) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('logo', logoFile);

      const response = await fetch('/api/tenants/upload-logo', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      
      // Update branding with new logo URL
      await updateBrandingMutation.mutateAsync({ logoUrl: data.logoUrl });

      toast({
        title: "Logo Uploaded",
        description: "Your consultant logo has been successfully uploaded.",
      });

      setLogoFile(null);
      setLogoPreview(null);
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload logo.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveColors = () => {
    updateBrandingMutation.mutate({
      brandColorPrimary: primaryColor,
      brandColorSecondary: secondaryColor,
    });
  };

  const currentLogoUrl = (brandingData as any)?.logoUrl || logoPreview;
  const currentPrimaryColor = (brandingData as any)?.brandColorPrimary || primaryColor;
  const currentSecondaryColor = (brandingData as any)?.brandColorSecondary || secondaryColor;

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="h-6 w-6 text-primary" />
          <h1 className="text-3xl font-bold">White-Label Branding</h1>
        </div>
        <p className="text-muted-foreground">
          Customize your branding for client-facing reports and dashboards
        </p>
      </div>

      {/* Enterprise Tier Badge */}
      <Alert className="mb-6 border-yellow-500/50 bg-yellow-500/10">
        <Crown className="h-4 w-4 text-yellow-500" />
        <AlertDescription className="text-foreground">
          White-label branding is available on the Enterprise Consultant tier.
          Upgrade your account to unlock custom branding features.
        </AlertDescription>
      </Alert>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Logo Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Consultant Logo
            </CardTitle>
            <CardDescription>
              Upload your company logo for reports and client dashboards
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Current Logo */}
            {currentLogoUrl && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <Label className="text-sm text-muted-foreground mb-2 block">Current Logo</Label>
                <div className="flex items-center justify-center h-32 bg-white rounded">
                  <img 
                    src={currentLogoUrl} 
                    alt="Consultant Logo" 
                    className="max-h-28 max-w-full object-contain"
                  />
                </div>
              </div>
            )}

            {/* Upload New Logo */}
            <div className="space-y-2">
              <Label htmlFor="logo-upload">Upload New Logo</Label>
              <Input
                id="logo-upload"
                type="file"
                accept="image/*"
                onChange={handleLogoSelect}
                disabled={isUploading}
                data-testid="input-logo-upload"
              />
              <p className="text-xs text-muted-foreground">
                PNG, JPG, or SVG. Max size: 2MB. Recommended: 400x100px
              </p>
            </div>

            {/* Logo Preview */}
            {logoPreview && (
              <div className="border rounded-lg p-4 bg-muted/50">
                <Label className="text-sm text-muted-foreground mb-2 block">Preview</Label>
                <div className="flex items-center justify-center h-32 bg-white rounded">
                  <img 
                    src={logoPreview} 
                    alt="Logo Preview" 
                    className="max-h-28 max-w-full object-contain"
                  />
                </div>
              </div>
            )}

            <Button 
              onClick={handleUploadLogo}
              disabled={!logoFile || isUploading}
              className="w-full"
              data-testid="button-upload-logo"
            >
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Upload Logo
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Brand Colors Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Brand Colors
            </CardTitle>
            <CardDescription>
              Set your brand colors for consistent styling
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Primary Color */}
            <div className="space-y-2">
              <Label htmlFor="primary-color">Primary Brand Color</Label>
              <div className="flex gap-2">
                <Input
                  id="primary-color"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-12 w-20"
                  data-testid="input-primary-color"
                />
                <Input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  placeholder="#0066CC"
                  className="flex-1"
                  data-testid="input-primary-color-hex"
                />
              </div>
              <div 
                className="h-16 rounded border"
                style={{ backgroundColor: primaryColor }}
              />
            </div>

            {/* Secondary Color */}
            <div className="space-y-2">
              <Label htmlFor="secondary-color">Secondary Brand Color</Label>
              <div className="flex gap-2">
                <Input
                  id="secondary-color"
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-12 w-20"
                  data-testid="input-secondary-color"
                />
                <Input
                  type="text"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  placeholder="#00CC66"
                  className="flex-1"
                  data-testid="input-secondary-color-hex"
                />
              </div>
              <div 
                className="h-16 rounded border"
                style={{ backgroundColor: secondaryColor }}
              />
            </div>

            <Button 
              onClick={handleSaveColors}
              disabled={updateBrandingMutation.isPending}
              className="w-full"
              data-testid="button-save-colors"
            >
              {updateBrandingMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Colors
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              Branding Preview
            </CardTitle>
            <CardDescription>
              See how your branding will appear on reports and client dashboards
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-8 space-y-6">
              {/* Report Header Preview */}
              <div className="border-b pb-4">
                <div className="flex items-center justify-between">
                  {currentLogoUrl && (
                    <img 
                      src={currentLogoUrl} 
                      alt="Logo" 
                      className="h-12 object-contain"
                    />
                  )}
                  <div className="text-right">
                    <h3 className="font-semibold" style={{ color: currentPrimaryColor }}>
                      R2v3 Assessment Report
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Prepared by {user.tenant?.name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Content Preview */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div 
                    className="w-1 h-8 rounded"
                    style={{ backgroundColor: currentPrimaryColor }}
                  />
                  <h4 className="font-semibold text-lg">Assessment Summary</h4>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Status</p>
                    <p className="font-semibold" style={{ color: currentSecondaryColor }}>
                      In Progress
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Completion</p>
                    <p className="font-semibold" style={{ color: currentPrimaryColor }}>
                      75%
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Score</p>
                    <p className="font-semibold">92/100</p>
                  </div>
                </div>

                <Button 
                  style={{ 
                    backgroundColor: currentPrimaryColor,
                    borderColor: currentPrimaryColor,
                  }}
                  className="text-white hover:opacity-90"
                >
                  Generate Full Report
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Success Message */}
      {(brandingData as any)?.logoUrl && (
        <Alert className="mt-6 border-green-500/50 bg-green-500/10">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <AlertDescription className="text-foreground">
            Your white-label branding is active and will appear on all client-facing reports and dashboards.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
