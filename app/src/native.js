/* Device features. In the Android/iOS app these use Capacitor plugins; in a browser they fall back
   to the web APIs the prototype used, so the same build also runs as a website for testing. */
import { Capacitor } from '@capacitor/core';

export const isNative = Capacitor.isNativePlatform();
export const platform = Capacitor.getPlatform(); // 'android' | 'ios' | 'web'

/* Native camera or gallery. Returns a Blob, or null if the person cancelled. */
export async function nativePhoto(fromCamera) {
  const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
  try {
    const p = await Camera.getPhoto({
      source: fromCamera ? CameraSource.Camera : CameraSource.Photos,
      resultType: CameraResultType.Uri,
      quality: 85,
      width: 1600,
      correctOrientation: true,
      saveToGallery: false,
    });
    return await (await fetch(p.webPath)).blob();
  } catch (e) {
    if (/cancel/i.test(String(e && e.message))) return null;
    throw e;
  }
}

const toPos = (p) => ({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy });

export async function getPosition() {
  if (isNative) {
    const { Geolocation } = await import('@capacitor/geolocation');
    return toPos(await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 }));
  }
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Location is not available on this device.'));
    navigator.geolocation.getCurrentPosition((p) => resolve(toPos(p)), reject, { enableHighAccuracy: true, timeout: 10000 });
  });
}

/* True when location access was already granted, so watching it shows no permission prompt. */
export async function locationGranted() {
  try {
    if (isNative) {
      const { Geolocation } = await import('@capacitor/geolocation');
      return (await Geolocation.checkPermissions()).location === 'granted';
    }
    if (navigator.permissions && navigator.permissions.query) return (await navigator.permissions.query({ name: 'geolocation' })).state === 'granted';
  } catch (e) {}
  return false;
}

export async function watchPosition(onPos, onErr) {
  if (isNative) {
    const { Geolocation } = await import('@capacitor/geolocation');
    return Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 15000 }, (p, err) => (err ? onErr(err) : p && onPos(toPos(p))));
  }
  if (!navigator.geolocation) return onErr(new Error('unavailable'));
  return navigator.geolocation.watchPosition((p) => onPos(toPos(p)), onErr, { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 });
}

/* In-app notifications: shown while the app is running (no Firebase needed). */
export async function notificationPermission(ask) {
  if (isNative) {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    let p = await LocalNotifications.checkPermissions();
    if (ask && p.display !== 'granted') p = await LocalNotifications.requestPermissions();
    return p.display === 'granted';
  }
  if (!('Notification' in window)) return false;
  if (ask && Notification.permission === 'default') await Notification.requestPermission();
  return Notification.permission === 'granted';
}

let nextId = Math.floor(Date.now() / 1000) % 100000;
export async function notify(title, body) {
  try {
    if (!(await notificationPermission(false))) return false;
    if (isNative) {
      const { LocalNotifications } = await import('@capacitor/local-notifications');
      await LocalNotifications.schedule({ notifications: [{ id: nextId++, title, body }] });
    } else {
      new Notification(title, { body });
    }
    return true;
  } catch (e) {
    return false;
  }
}

/* Background push via Firebase. Only enabled when VITE_PUSH_ENABLED=true AND google-services.json is in
   the Android project: calling register() without Firebase configured crashes the app on Android. */
export async function setupPush(onToken) {
  if (!isNative || import.meta.env.VITE_PUSH_ENABLED !== 'true') return false;
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    let p = await PushNotifications.checkPermissions();
    if (p.receive === 'prompt' || p.receive === 'prompt-with-rationale') p = await PushNotifications.requestPermissions();
    if (p.receive !== 'granted') return false;
    await PushNotifications.addListener('registration', (t) => onToken(t.value));
    await PushNotifications.addListener('registrationError', (e) => console.warn('push registration failed', e));
    await PushNotifications.register();
    return true;
  } catch (e) {
    console.warn('push unavailable', e);
    return false;
  }
}

/* Android back button: handler returns true if it handled the press; otherwise the app closes. */
export async function onBackButton(handler) {
  if (!isNative) return;
  const { App } = await import('@capacitor/app');
  App.addListener('backButton', () => { if (!handler()) App.exitApp(); });
}

export async function onResume(handler) {
  if (isNative) {
    const { App } = await import('@capacitor/app');
    App.addListener('resume', handler);
  } else {
    document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && handler());
  }
}
