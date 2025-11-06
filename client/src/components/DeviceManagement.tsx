import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Alert, AlertDescription } from './ui/alert';
import { 
  Smartphone, 
  Monitor, 
  Tablet, 
  Shield, 
  ShieldCheck, 
  ShieldX, 
  Calendar,
  MapPin,
  Trash2,
  Eye,
  EyeOff
} from 'lucide-react';

interface Device {
  id: string;
  name: string;
  type: 'desktop' | 'mobile' | 'tablet';
  trusted: boolean;
  lastSeen: string;
  location: string;
  userAgent: string;
  ipAddress: string;
  isCurrentDevice: boolean;
}

export default function DeviceManagement() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState<string | null>(null);

  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      const response = await fetch('/api/auth/devices', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      const data = await response.json();

      if (data.success) {
        setDevices(data.devices);
      }
    } catch (error) {
      console.error('Failed to fetch devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTrustDevice = async (deviceId: string) => {
    try {
      const response = await fetch(`/api/auth/devices/${deviceId}/trust`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        await fetchDevices();
      }
    } catch (error) {
      console.error('Failed to trust device:', error);
    }
  };

  const handleRevokeDevice = async (deviceId: string) => {
    if (!confirm('Are you sure you want to revoke this device? You will need to re-authenticate from this device.')) {
      return;
    }

    try {
      const response = await fetch(`/api/auth/devices/${deviceId}/revoke`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        await fetchDevices();
      }
    } catch (error) {
      console.error('Failed to revoke device:', error);
    }
  };

  const getDeviceIcon = (type: string) => {
    switch (type) {
      case 'mobile':
        return <Smartphone className="h-5 w-5" />;
      case 'tablet':
        return <Tablet className="h-5 w-5" />;
      default:
        return <Monitor className="h-5 w-5" />;
    }
  };

  const getTrustIcon = (trusted: boolean) => {
    return trusted ? (
      <ShieldCheck className="h-4 w-4 text-green-600" />
    ) : (
      <ShieldX className="h-4 w-4 text-red-600" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <p>Loading devices...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Device Management</h2>
        <p className="text-foreground">Manage and monitor devices that have access to your account</p>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Trusted devices can access your account without additional verification. 
          Review and revoke access for any unfamiliar devices.
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        {devices.map((device) => (
          <Card key={device.id} className={device.isCurrentDevice ? 'border-blue-200 bg-blue-500/10' : ''}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  {getDeviceIcon(device.type)}
                  <div>
                    <CardTitle className="text-lg">{device.name}</CardTitle>
                    <CardDescription className="flex items-center space-x-2">
                      {getTrustIcon(device.trusted)}
                      <span>{device.trusted ? 'Trusted Device' : 'Untrusted Device'}</span>
                      {device.isCurrentDevice && (
                        <Badge variant="outline" className="text-xs">Current Device</Badge>
                      )}
                    </CardDescription>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDetails(showDetails === device.id ? null : device.id)}
                  >
                    {showDetails === device.id ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  {!device.trusted && (
                    <Button
                      size="sm"
                      onClick={() => handleTrustDevice(device.id)}
                    >
                      Trust Device
                    </Button>
                  )}
                  {!device.isCurrentDevice && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleRevokeDevice(device.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>

            {showDetails === device.id && (
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center space-x-2">
                    <Calendar className="h-4 w-4 text-foreground" />
                    <span className="text-foreground">Last seen:</span>
                    <span>{new Date(device.lastSeen).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-foreground" />
                    <span className="text-foreground">Location:</span>
                    <span>{device.location}</span>
                  </div>
                  <div className="col-span-1 md:col-span-2">
                    <span className="text-foreground">User Agent:</span>
                    <p className="text-xs font-mono bg-muted p-2 rounded mt-1">
                      {device.userAgent}
                    </p>
                  </div>
                  <div>
                    <span className="text-foreground">IP Address:</span>
                    <p className="font-mono">{device.ipAddress}</p>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {devices.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Shield className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium text-foreground mb-2">No Devices Found</h3>
            <p className="text-foreground">
              No devices are currently registered to your account.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}