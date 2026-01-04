import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { loadStripe } from "@stripe/stripe-js";
import { Link } from "wouter";
import { 
  ShoppingCart, 
  Check, 
  Crown, 
  Users, 
  Building, 
  HeadphonesIcon,
  ArrowRight,
  Badge as BadgeIcon,
  AlertCircle,
  Zap,
  Calendar,
  CreditCard,
  Plus,
  Minus
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { apiGet, apiPost } from "@/api";

// Enhanced Stripe initialization - fetches key from backend to ensure consistency
const getStripeInstance = async () => {
  try {
    // Get the public key from the backend to ensure it matches the server's mode
    const response = await fetch('/api/stripe/public-key', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to get Stripe public key');
    }

    const { publicKey } = await response.json();

    if (!publicKey) {
      throw new Error('No Stripe public key available');
    }

    console.log('Licenses using Stripe public key:', publicKey.substring(0, 12) + '...');

    return loadStripe(publicKey, {
      apiVersion: '2024-06-20',
      locale: 'en'
    });
  } catch (error) {
    console.error('Stripe initialization error:', error);
    throw error;
  }
};

interface License {
  id: string;
  tenantId: string;
  planId: string;
  planName: string;
  accountType: string;
  licenseType: string;
  tier?: string;
  isActive: boolean;
  maxFacilities: number | null;
  maxSeats: number | null;
  maxClients?: number | null;
  supportTier: string | null;
  supportHours?: number | null;
  features: Record<string, any>;
  createdAt: string;
  amountPaid: number;
  currency: string;
  originalPrice?: number;
  discountPercent?: number;
  discountAmount?: number;
  quantity?: number;
}

interface LicenseConfig {
  name: string;
  price: number;
  licenseType: string;
  accountType: string;
  tier?: string;
  maxFacilities?: number;
  maxSeats?: number;
  maxClients?: number;
  supportHours?: number;
  supportTier?: string;
  features: Record<string, any>;
  description?: string;
}

export default function Licenses() {
  const [selectedTab, setSelectedTab] = useState("current");
  const [addonQuantities, setAddonQuantities] = useState<Record<string, number>>({});
  const { user } = useAuth();
  const { toast } = useToast();

  // Fetch current licenses
  const { data: licenses = [], isLoading: licensesLoading, refetch: refetchLicenses } = useQuery<License[]>({
    queryKey: ['licenses'],
    queryFn: async () => {
      const response = await apiGet<{ licenses: License[]; count: number }>('/api/licenses');
      return response.licenses || [];
    },
  });

  // Fetch available license configurations
  const { data: licenseConfigs = {}, isLoading: configsLoading } = useQuery<Record<string, LicenseConfig>>({
    queryKey: ['license-configs'],
    queryFn: () => apiGet<Record<string, LicenseConfig>>('/api/stripe/licenses'),
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async ({ licenseId, quantity = 1 }: { licenseId: string; quantity?: number }) => {
      const response = await apiPost<{ sessionId: string }>('/api/stripe/create-checkout-session', {
        licenseId,
        quantity,
      });
      
      // Get Stripe instance with proper key from backend
      const stripe = await getStripeInstance();
      if (!stripe) throw new Error('Stripe failed to load');
      
      const { error } = await stripe.redirectToCheckout({
        sessionId: response.sessionId,
      });
      
      if (error) {
        throw new Error(error.message);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Purchase Failed",
        description: error.message || "Failed to initiate purchase",
        variant: "destructive",
      });
    },
  });

  const handlePurchase = (licenseId: string, quantity = 1) => {
    purchaseMutation.mutate({ licenseId, quantity });
  };

  const updateAddonQuantity = (addonId: string, change: number) => {
    setAddonQuantities(prev => ({
      ...prev,
      [addonId]: Math.max(1, (prev[addonId] || 1) + change)
    }));
  };

  const getAddonQuantity = (addonId: string) => {
    return addonQuantities[addonId] || 1;
  };

  const calculatePrice = (basePrice: number, quantity: number) => {
    // Volume discount calculation
    let discountPercent = 0;
    if (quantity >= 50) discountPercent = 20;
    else if (quantity >= 20) discountPercent = 15;
    else if (quantity >= 10) discountPercent = 10;

    const totalPrice = basePrice * quantity;
    const discountAmount = (totalPrice * discountPercent) / 100;
    const finalPrice = totalPrice - discountAmount;

    return {
      originalPrice: totalPrice,
      finalPrice,
      discountPercent,
      discountAmount,
      pricePerUnit: finalPrice / quantity
    };
  };

  const calculateFacilityPrice = (quantity: number) => {
    // Facility bulk pricing as per r2v3_pricing_strategy.md
    let pricePerFacility = 40000; // $400 base price
    
    if (quantity >= 20) {
      pricePerFacility = 30000; // $300 each for 20+
    } else if (quantity >= 10) {
      pricePerFacility = 30000; // $300 each for 10-19
    } else if (quantity >= 5) {
      pricePerFacility = 35000; // $350 each for 5-9
    }
    
    const totalPrice = pricePerFacility * quantity;
    const originalPrice = 40000 * quantity; // Original price at $400 each
    const discountAmount = originalPrice - totalPrice;
    const discountPercent = quantity >= 5 ? Math.round((discountAmount / originalPrice) * 100) : 0;

    return {
      originalPrice,
      finalPrice: totalPrice,
      discountPercent,
      discountAmount,
      pricePerUnit: pricePerFacility
    };
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price / 100);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getLicenseIcon = (licenseType: string) => {
    switch (licenseType) {
      case 'base':
        return <BadgeIcon className="h-5 w-5" />;
      case 'facility_addon':
      case 'facility_pack':
        return <Building className="h-5 w-5" />;
      case 'seat_addon':
      case 'seats':
        return <Users className="h-5 w-5" />;
      case 'support_service':
      case 'support_tier':
        return <HeadphonesIcon className="h-5 w-5" />;
      default:
        return <Zap className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (license: License) => {
    if (license.isActive) {
      return <Badge variant="default" className="bg-jade/10 text-jade">Active</Badge>;
    } else {
      return <Badge variant="secondary">Inactive</Badge>;
    }
  };

  const groupLicensesByType = (licenses: License[]) => {
    const groups: Record<string, License[]> = {};
    licenses.forEach(license => {
      if (!groups[license.licenseType]) {
        groups[license.licenseType] = [];
      }
      groups[license.licenseType]?.push(license);
    });
    return groups;
  };

  const getCurrentUsage = () => {
    const baseLicenses = licenses.filter(l => l.licenseType === 'base' && l.isActive);
    const facilityPacks = licenses.filter(l => l.licenseType.includes('facility') && l.isActive);
    const seatPacks = licenses.filter(l => l.licenseType.includes('seat') && l.isActive);
    
    const totalFacilities = baseLicenses.reduce((sum, l) => sum + (l.maxFacilities || 0), 0) +
                           facilityPacks.reduce((sum, l) => sum + (l.maxFacilities || 0), 0);
    
    const totalSeats = baseLicenses.reduce((sum, l) => sum + (l.maxSeats || 0), 0) +
                      seatPacks.reduce((sum, l) => sum + (l.maxSeats || 0), 0);

    const totalClients = baseLicenses.reduce((sum, l) => sum + (l.maxClients || 0), 0);

    return { totalFacilities, totalSeats, totalClients };
  };

  if (licensesLoading || configsLoading) {
    return (
      <div className="p-6">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-muted/40 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 bg-muted/40 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const usage = getCurrentUsage();
  const groupedLicenses = groupLicensesByType(licenses);

  return (
    <div className="p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-foreground">License Management</h1>
          <p className="text-muted-foreground mt-1">Manage your R2v3 licenses and upgrade paths</p>
        </div>

        {/* Current Usage Overview */}
        {licenses.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Building className="h-5 w-5 text-jade" />
                  <h3 className="font-medium">Total Facilities</h3>
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {usage.totalFacilities}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-jade" />
                  <h3 className="font-medium">Total Seats</h3>
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {usage.totalSeats}
                </p>
              </CardContent>
            </Card>
            {usage.totalClients > 0 && (
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center space-x-2">
                    <Building className="h-5 w-5 text-jade" />
                    <h3 className="font-medium">Client Businesses</h3>
                  </div>
                  <p className="text-2xl font-bold text-foreground mt-2">
                    {usage.totalClients}
                  </p>
                </CardContent>
              </Card>
            )}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center space-x-2">
                  <BadgeIcon className="h-5 w-5 text-jade" />
                  <h3 className="font-medium">Active Licenses</h3>
                </div>
                <p className="text-2xl font-bold text-foreground mt-2">
                  {licenses.filter(l => l.isActive).length}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="current">Current Licenses</TabsTrigger>
            <TabsTrigger value="purchase">Upgrade / Purchase</TabsTrigger>
          </TabsList>

          <TabsContent value="current" className="space-y-6">
            {licenses.length === 0 ? (
              <Card>
                <CardContent className="p-8 text-center">
                  <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No Licenses Found</h3>
                  <p className="text-muted-foreground mb-6">You don't have any active licenses yet. Purchase a base license to get started.</p>
                  <Button onClick={() => setSelectedTab("purchase")}>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Browse Plans
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {Object.entries(groupedLicenses).map(([type, typeLicenses]) => (
                  <div key={type}>
                    <h3 className="text-lg font-semibold text-foreground mb-3 capitalize">
                      {type.replace('_', ' ')} Licenses
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {typeLicenses.map((license) => (
                        <Card key={license.id}>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2">
                                {getLicenseIcon(license.licenseType)}
                                <CardTitle className="text-lg">{license.planName}</CardTitle>
                              </div>
                              {getStatusBadge(license)}
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="space-y-3">
                              {license.tier && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Tier:</span>
                                  <Badge variant="outline" className="capitalize">
                                    {license.tier}
                                  </Badge>
                                </div>
                              )}
                              {license.maxFacilities && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Facilities:</span>
                                  <span className="font-medium">{license.maxFacilities}</span>
                                </div>
                              )}
                              {license.maxSeats && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Seats:</span>
                                  <span className="font-medium">{license.maxSeats}</span>
                                </div>
                              )}
                              {license.maxClients && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Client Businesses:</span>
                                  <span className="font-medium">{license.maxClients}</span>
                                </div>
                              )}
                              {license.supportHours && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Support Hours:</span>
                                  <span className="font-medium">{license.supportHours}h</span>
                                </div>
                              )}
                              {license.supportTier && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Support:</span>
                                  <Badge variant="outline" className="capitalize">
                                    {license.supportTier}
                                  </Badge>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Purchased:</span>
                                <span className="text-sm">{formatDate(license.createdAt)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Amount Paid:</span>
                                <span className="font-medium">{formatPrice(license.amountPaid)}</span>
                              </div>
                              {license.discountPercent && license.discountPercent > 0 && (
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">Discount Applied:</span>
                                  <span className="text-jade font-medium">{license.discountPercent}% off</span>
                                </div>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Tier Comparison Section */}
          <TabsContent value="purchase" className="space-y-6">
            {/* Business Tiers */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">For Recycling Businesses</h2>
                <p className="text-muted-foreground">Complete R2v3 certification platform with tier-based features</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Solo Business */}
                <Card className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Solo Business</CardTitle>
                      <Badge variant="outline">Entry Level</Badge>
                    </div>
                    <div className="text-3xl font-bold text-jade">{formatPrice(39900)}</div>
                    <p className="text-sm text-muted-foreground">One-time payment</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>1 facility, 1–3 seats</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Self-Assessment Module</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>REC Mapping Dashboard</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Scope Generator</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Export to PDF, Excel, Word</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Training Center</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-3">
                        <strong>Add-ons:</strong> Extra seats: $50 each
                      </div>
                    </div>
                    <Button 
                      onClick={() => handlePurchase('solo_business')}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-purchase-solo"
                    >
                      {purchaseMutation.isPending ? 'Processing...' : 'Purchase Solo'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Team Business */}
                <Card className="relative border-jade/50">
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-jade text-white">Most Popular</Badge>
                  </div>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Team Business</CardTitle>
                      <Badge variant="default" className="bg-jade/10 text-jade">Sweet Spot</Badge>
                    </div>
                    <div className="text-3xl font-bold text-jade">{formatPrice(89900)}</div>
                    <p className="text-sm text-muted-foreground">One-time payment</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span><strong>2 facilities</strong>, up to 10 seats</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>All Solo features</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span><strong>Business Admin Panel</strong></span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Role-based access control</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Activity logs</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-3">
                        <strong>Add-ons:</strong> Extra facilities: $400 each (+5 seats)<br />
                        Extra seats: $45 each
                      </div>
                    </div>
                    <Button 
                      onClick={() => handlePurchase('team_business')}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-purchase-team"
                    >
                      {purchaseMutation.isPending ? 'Processing...' : 'Purchase Team'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Enterprise Business */}
                <Card className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Enterprise Multi-Site</CardTitle>
                      <Badge variant="outline" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none">
                        <Crown className="h-3 w-3 mr-1" />Premium
                      </Badge>
                    </div>
                    <div className="text-3xl font-bold text-jade">{formatPrice(179900)}</div>
                    <p className="text-sm text-muted-foreground">One-time payment</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span><strong>3 facilities</strong>, up to 25 seats</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>All Team features</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span><strong>Internal Oversight Tools</strong></span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Corporate compliance dashboard</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Multi-site reporting</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-3">
                        <strong>Add-ons:</strong> Cross-Facility Oversight: $1,000<br />
                        Bulk facility packs available
                      </div>
                    </div>
                    <Button 
                      onClick={() => handlePurchase('enterprise_business')}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-purchase-enterprise"
                    >
                      {purchaseMutation.isPending ? 'Processing...' : 'Purchase Enterprise'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Consultant Tiers */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">For Consultants / Certifying Bodies</h2>
                <p className="text-muted-foreground">Manage multiple client businesses with advanced collaboration tools</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Independent Consultant */}
                <Card className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Independent Consultant</CardTitle>
                      <Badge variant="outline">Freelance</Badge>
                    </div>
                    <div className="text-3xl font-bold text-jade">{formatPrice(59900)}</div>
                    <p className="text-sm text-muted-foreground">One-time payment</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Manage up to <strong>5 client businesses</strong></span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>All toolkit features</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Client management dashboard</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Assessment templates</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-3">
                        <strong>Add-ons:</strong> Extra businesses: $100 each
                      </div>
                    </div>
                    <Button 
                      onClick={() => handlePurchase('independent_consultant')}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-purchase-independent"
                    >
                      {purchaseMutation.isPending ? 'Processing...' : 'Purchase Independent'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Agency Consultant */}
                <Card className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Agency Consultant</CardTitle>
                      <Badge variant="default" className="bg-jade/10 text-jade">Regional</Badge>
                    </div>
                    <div className="text-3xl font-bold text-jade">{formatPrice(119900)}</div>
                    <p className="text-sm text-muted-foreground">One-time payment</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Manage up to <strong>15 businesses</strong></span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>All Independent features</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span><strong>Dedicated collaboration tools</strong></span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Team workflow management</span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-3">
                        <strong>Add-ons:</strong> Extra businesses: $90 each
                      </div>
                    </div>
                    <Button 
                      onClick={() => handlePurchase('agency_consultant')}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-purchase-agency"
                    >
                      {purchaseMutation.isPending ? 'Processing...' : 'Purchase Agency'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Enterprise Agency */}
                <Card className="relative">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Enterprise Agency / CB</CardTitle>
                      <Badge variant="outline" className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-none">
                        <Crown className="h-3 w-3 mr-1" />Enterprise
                      </Badge>
                    </div>
                    <div className="text-3xl font-bold text-jade">{formatPrice(249900)}</div>
                    <p className="text-sm text-muted-foreground">One-time payment</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Manage up to <strong>50 businesses</strong></span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>All Agency features</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span><strong>White-label branding</strong></span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span><strong>Premium dashboards</strong></span>
                      </div>
                      <div className="text-sm text-muted-foreground mt-3">
                        <strong>Add-ons:</strong> Extra businesses: $75 each<br />
                        50+ clients: Custom enterprise deal
                      </div>
                    </div>
                    <Button 
                      onClick={() => handlePurchase('enterprise_consultant')}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-purchase-enterprise-consultant"
                    >
                      {purchaseMutation.isPending ? 'Processing...' : 'Purchase Enterprise'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Support & Services */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Support & Services</h2>
                <p className="text-muted-foreground">Professional guidance and consulting services</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Lite Support Pack */}
                <Card className="relative">
                  <CardHeader>
                    <CardTitle className="text-lg">Lite Support Pack</CardTitle>
                    <div className="text-3xl font-bold text-jade">{formatPrice(50000)}</div>
                    <p className="text-sm text-muted-foreground">One-time purchase</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Email support for self-assessment review</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span><strong>3-hour consultant Q&A block</strong></span>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handlePurchase('lite_support_pack')}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-purchase-lite-support"
                    >
                      {purchaseMutation.isPending ? 'Processing...' : 'Purchase Lite Support'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Full Guidance Pack */}
                <Card className="relative border-jade/50">
                  <CardHeader>
                    <CardTitle className="text-lg">Full Guidance Pack</CardTitle>
                    <div className="text-3xl font-bold text-jade">{formatPrice(175000)}</div>
                    <p className="text-sm text-muted-foreground">One-time purchase</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span><strong>Dedicated consultant hours (up to 12 hrs)</strong></span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Live video sessions</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Mock audit walkthrough</span>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handlePurchase('full_guidance_pack')}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-purchase-full-guidance"
                    >
                      {purchaseMutation.isPending ? 'Processing...' : 'Purchase Full Guidance'}
                    </Button>
                  </CardContent>
                </Card>

                {/* Premium Hourly */}
                <Card className="relative">
                  <CardHeader>
                    <CardTitle className="text-lg">Premium Hourly</CardTitle>
                    <div className="text-3xl font-bold text-jade">{formatPrice(22500)}</div>
                    <p className="text-sm text-muted-foreground">Per hour</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Rush or specialty consulting</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Appendix B data sanitization</span>
                      </div>
                      <div className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-jade mr-2" />
                        <span>Downstream vendor mapping</span>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handlePurchase('premium_hourly')}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-purchase-premium-hourly"
                    >
                      {purchaseMutation.isPending ? 'Processing...' : 'Purchase Hours'}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Add-ons Section */}
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Add-ons & Extensions</h2>
                <p className="text-muted-foreground">Extend your license with additional seats, facilities, or clients</p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {/* Extra Seats - Solo Business */}
                <Card className="relative">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      Extra Seats (Solo)
                    </CardTitle>
                    <div className="text-2xl font-bold text-jade">{formatPrice(5000)}</div>
                    <p className="text-sm text-muted-foreground">Per additional seat</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Quantity:</span>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => updateAddonQuantity('solo_seats', -1)}
                          data-testid="button-decrease-solo-seats"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center">{getAddonQuantity('solo_seats')}</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => updateAddonQuantity('solo_seats', 1)}
                          data-testid="button-increase-solo-seats"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {getAddonQuantity('solo_seats') >= 10 && (
                      <div className="text-sm bg-jade/10 p-2 rounded">
                        <strong className="text-jade">Volume Discount: {calculatePrice(5000, getAddonQuantity('solo_seats')).discountPercent}% off!</strong>
                        <br />Total: {formatPrice(calculatePrice(5000, getAddonQuantity('solo_seats')).finalPrice)}
                      </div>
                    )}
                    <Button 
                      onClick={() => handlePurchase('solo_seat_addon', getAddonQuantity('solo_seats'))}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-purchase-solo-seats"
                    >
                      {purchaseMutation.isPending ? 'Processing...' : `Add ${getAddonQuantity('solo_seats')} Seats`}
                    </Button>
                  </CardContent>
                </Card>

                {/* Extra Seats - Team Business */}
                <Card className="relative">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Users className="h-5 w-5 mr-2" />
                      Extra Seats (Team)
                    </CardTitle>
                    <div className="text-2xl font-bold text-jade">{formatPrice(4500)}</div>
                    <p className="text-sm text-muted-foreground">Per additional seat</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Quantity:</span>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => updateAddonQuantity('team_seats', -1)}
                          data-testid="button-decrease-team-seats"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center">{getAddonQuantity('team_seats')}</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => updateAddonQuantity('team_seats', 1)}
                          data-testid="button-increase-team-seats"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {getAddonQuantity('team_seats') >= 10 && (
                      <div className="text-sm bg-jade/10 p-2 rounded">
                        <strong className="text-jade">Volume Discount: {calculatePrice(4500, getAddonQuantity('team_seats')).discountPercent}% off!</strong>
                        <br />Total: {formatPrice(calculatePrice(4500, getAddonQuantity('team_seats')).finalPrice)}
                      </div>
                    )}
                    <Button 
                      onClick={() => handlePurchase('team_seat_addon', getAddonQuantity('team_seats'))}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-purchase-team-seats"
                    >
                      {purchaseMutation.isPending ? 'Processing...' : `Add ${getAddonQuantity('team_seats')} Seats`}
                    </Button>
                  </CardContent>
                </Card>

                {/* Extra Facilities */}
                <Card className="relative">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Building className="h-5 w-5 mr-2" />
                      Extra Facilities
                    </CardTitle>
                    <div className="text-2xl font-bold text-jade">{formatPrice(40000)}</div>
                    <p className="text-sm text-muted-foreground">Per facility (+5 seats)</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Quantity:</span>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => updateAddonQuantity('facilities', -1)}
                          data-testid="button-decrease-facilities"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center">{getAddonQuantity('facilities')}</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => updateAddonQuantity('facilities', 1)}
                          data-testid="button-increase-facilities"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {getAddonQuantity('facilities') >= 5 && (
                      <div className="text-sm bg-jade/10 p-2 rounded">
                        <strong className="text-jade">
                          Bulk Pricing: {formatPrice(calculateFacilityPrice(getAddonQuantity('facilities')).pricePerUnit)} each!
                        </strong>
                        <br />
                        Total: {formatPrice(calculateFacilityPrice(getAddonQuantity('facilities')).finalPrice)}
                        {calculateFacilityPrice(getAddonQuantity('facilities')).discountPercent > 0 && (
                          <span> ({calculateFacilityPrice(getAddonQuantity('facilities')).discountPercent}% off)</span>
                        )}
                      </div>
                    )}
                    <Button 
                      onClick={() => handlePurchase('facility_addon', getAddonQuantity('facilities'))}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-purchase-facilities"
                    >
                      {purchaseMutation.isPending ? 'Processing...' : `Add ${getAddonQuantity('facilities')} Facilities`}
                    </Button>
                  </CardContent>
                </Card>

                {/* Extra Client Businesses */}
                <Card className="relative">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <Building className="h-5 w-5 mr-2" />
                      Client Businesses
                    </CardTitle>
                    <div className="text-2xl font-bold text-jade">{formatPrice(10000)}</div>
                    <p className="text-sm text-muted-foreground">Per client business</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Quantity:</span>
                      <div className="flex items-center space-x-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => updateAddonQuantity('clients', -1)}
                          data-testid="button-decrease-clients"
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center">{getAddonQuantity('clients')}</span>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => updateAddonQuantity('clients', 1)}
                          data-testid="button-increase-clients"
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    {getAddonQuantity('clients') >= 10 && (
                      <div className="text-sm bg-jade/10 p-2 rounded">
                        <strong className="text-jade">Volume Discount: {calculatePrice(10000, getAddonQuantity('clients')).discountPercent}% off!</strong>
                        <br />Total: {formatPrice(calculatePrice(10000, getAddonQuantity('clients')).finalPrice)}
                      </div>
                    )}
                    <Button 
                      onClick={() => handlePurchase('client_addon', getAddonQuantity('clients'))}
                      disabled={purchaseMutation.isPending}
                      className="w-full"
                      data-testid="button-purchase-clients"
                    >
                      {purchaseMutation.isPending ? 'Processing...' : `Add ${getAddonQuantity('clients')} Clients`}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>

            {/* Volume Discounts Notice */}
            <Alert>
              <Zap className="h-4 w-4" />
              <AlertDescription>
                <strong>Volume Discounts Available:</strong> Get automatic discounts on bulk purchases - 10% off at 10+ items, 15% off at 20+, and 20% off at 50+ items. Bulk facility packs (5-9: $350 each, 10-20: $300 each, 20+: $300 each) also available.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}