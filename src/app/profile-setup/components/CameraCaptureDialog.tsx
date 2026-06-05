'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Camera, Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

interface CameraCaptureDialogProps {
    onClose: () => void;
    onCapture: (imageDataUrl: string) => void;
}

export default function CameraCaptureDialog({ onClose, onCapture }: CameraCaptureDialogProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    
    const [hasCameraPermission, setHasCameraPermission] = useState(true);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
    const [isCameraReady, setIsCameraReady] = useState(false);
    
    const { toast } = useToast();

    // 1. Enumerate devices and get initial permission
    useEffect(() => {
        const getDevices = async () => {
            try {
                // This first call is to prompt for permission, which is required to get device labels.
                const tempStream = await navigator.mediaDevices.getUserMedia({ video: true });
                setHasCameraPermission(true);

                const devices = await navigator.mediaDevices.enumerateDevices();
                const videoInputs = devices.filter(device => device.kind === 'videoinput');
                
                if (videoInputs.length === 0) {
                    throw new Error("No camera found.");
                }

                setVideoDevices(videoInputs);
                if (videoInputs.length > 0) {
                    setSelectedDeviceId(videoInputs[0].deviceId);
                }

                // Stop the temporary stream once we have the device list.
                tempStream.getTracks().forEach(track => track.stop());

            } catch (err) {
                console.error("Error getting camera devices:", err);
                setHasCameraPermission(false);
                toast({
                    variant: "destructive",
                    title: "Camera Access Denied",
                    description: "Please enable camera permissions in your browser settings.",
                });
            }
        };

        getDevices();
    }, [toast]);

    // 2. Start/Stop stream based on selectedDeviceId
    useEffect(() => {
        // Stop any previous stream before starting a new one.
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
        setIsCameraReady(false);

        if (selectedDeviceId && hasCameraPermission) {
            const getStream = async () => {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({
                        video: { deviceId: { exact: selectedDeviceId } }
                    });
                    streamRef.current = stream; // Save stream for cleanup
                    if (videoRef.current) {
                        videoRef.current.srcObject = stream;
                        // onloadedmetadata ensures we don't try to capture before the video is ready.
                        videoRef.current.onloadedmetadata = () => {
                           setIsCameraReady(true);
                        };
                    }
                } catch (err) {
                    console.error("Error starting camera stream:", err);
                    setIsCameraReady(false);
                    toast({
                        variant: "destructive",
                        title: "Camera Error",
                        description: "Could not start the selected camera. It might be in use by another application.",
                    });
                }
            };
            getStream();
        }

        // Cleanup function to run when the component unmounts
        return () => {
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(track => track.stop());
                streamRef.current = null;
            }
        };
    }, [selectedDeviceId, hasCameraPermission, toast]);


    const handleCapture = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas || !isCameraReady) {
            toast({
                variant: 'destructive',
                title: 'Camera Not Ready',
                description: 'Please wait for the camera to load before capturing.',
            });
            return;
        }
        
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const context = canvas.getContext('2d');
        context?.drawImage(video, 0, 0, canvas.width, canvas.height);

        const dataUrl = canvas.toDataURL('image/jpeg');
        onCapture(dataUrl);
        onClose();
    }, [onCapture, onClose, toast, isCameraReady]);
    
    return (
        <Dialog open={true} onOpenChange={onClose}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Take a Photo</DialogTitle>
                </DialogHeader>
                
                <div className="space-y-4">
                    <div className="relative">
                        <video ref={videoRef} className="w-full aspect-video rounded-md bg-muted" autoPlay playsInline muted />
                        {!hasCameraPermission && (
                             <div className="absolute inset-0 flex items-center justify-center bg-black/80 rounded-md">
                                <Alert variant="destructive" className="w-auto">
                                    <Camera className="h-4 w-4" />
                                    <AlertTitle>Camera Access Required</AlertTitle>
                                    <AlertDescription>
                                        Please enable camera access.
                                    </AlertDescription>
                                </Alert>
                            </div>
                        )}
                        {!isCameraReady && hasCameraPermission && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-md">
                                <p className="text-white">Starting camera...</p>
                            </div>
                        )}
                    </div>
                    
                    {videoDevices.length > 1 && (
                        <div className="space-y-2">
                           <Label htmlFor="camera-select">Camera Source</Label>
                           <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                                <SelectTrigger id="camera-select">
                                    <SelectValue placeholder="Select a camera" />
                                </SelectTrigger>
                                <SelectContent>
                                    {videoDevices.map((device, index) => (
                                        <SelectItem key={device.deviceId} value={device.deviceId}>
                                            {device.label || `Camera ${index + 1}`}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                           </Select>
                        </div>
                    )}
                </div>

                <canvas ref={canvasRef} className="hidden" />
                
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}><X className="mr-2 h-4 w-4"/>Cancel</Button>
                    <Button onClick={handleCapture} disabled={!isCameraReady}>
                        <Check className="mr-2 h-4 w-4"/>Capture
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
