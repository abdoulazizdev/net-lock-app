import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeModules } from "react-native";
import { Schedule } from "../types";

const { ScheduleModule } = NativeModules;
const STORAGE_KEY = "schedules";

class ScheduleService {
  async getSchedules(packageName?: string): Promise<Schedule[]> {
    try {
      const raw = await AsyncStorage.getItem(STORAGE_KEY);
      const all: Schedule[] = raw ? JSON.parse(raw) : [];
      return packageName
        ? all.filter((s) => s.packageName === packageName)
        : all;
    } catch {
      return [];
    }
  }

  async saveSchedule(schedule: Schedule): Promise<void> {
    const all = await this.getSchedules();
    const idx = all.findIndex((s) => s.id === schedule.id);
    if (idx >= 0) all[idx] = schedule;
    else all.push(schedule);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
    await this.syncNativeAlarms();
  }

  async deleteSchedule(id: string): Promise<void> {
    const all = await this.getSchedules();
    const filtered = all.filter((s) => s.id !== id);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    await this.syncNativeAlarms();
  }

  async toggleSchedule(id: string): Promise<void> {
    const all = await this.getSchedules();
    const schedule = all.find((s) => s.id === id);
    if (schedule) {
      schedule.isActive = !schedule.isActive;
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(all));
      await this.syncNativeAlarms();
    }
  }

  // Vérifie si une schedule est active maintenant
  isScheduleActiveNow(schedule: Schedule): boolean {
    const now = new Date();
    const currentDay = now.getDay();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = schedule.startHour * 60 + schedule.startMinute;
    const endMinutes = schedule.endHour * 60 + schedule.endMinute;

    if (!schedule.days.includes(currentDay)) return false;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      // Chevauchement minuit
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  // Applique toutes les schedules actives maintenant
  async applyCurrentSchedules(
    packageName: string,
  ): Promise<"block" | "allow" | null> {
    const schedules = await this.getSchedules(packageName);
    const active = schedules.filter(
      (s) => s.isActive && this.isScheduleActiveNow(s),
    );
    if (active.length === 0) return null;
    // La dernière schedule active gagne
    return active[active.length - 1].action;
  }

  private async syncNativeAlarms(): Promise<void> {
    if (!ScheduleModule) return;
    try {
      const all = await this.getSchedules();
      const active = all.filter((s) => s.isActive);
      await ScheduleModule.scheduleAlarms(JSON.stringify(active));
    } catch (e) {
      console.error("Erreur sync alarms:", e);
    }
  }

  generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  formatTime(hour: number, minute: number): string {
    return `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  }
}

export default new ScheduleService();
