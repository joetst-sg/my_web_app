import {
  Briefcase, Camera, Car, ChefHat, Dumbbell, Gamepad2, Headphones, HeartPulse, House, Keyboard, Lamp, Leaf,
  ListChecks, Monitor, Mountain, Plane, Shield, Sparkles, Speaker, Tag, Watch,
} from 'lucide-react'

const icons = {
  sparkles: Sparkles, house: House, 'gamepad-2': Gamepad2, headphones: Headphones, camera: Camera, watch: Watch,
  plane: Plane, dumbbell: Dumbbell, 'chef-hat': ChefHat, briefcase: Briefcase, mountain: Mountain, car: Car,
  'list-checks': ListChecks, 'heart-pulse': HeartPulse, leaf: Leaf, speaker: Speaker, lamp: Lamp, shield: Shield,
  monitor: Monitor, keyboard: Keyboard,
} as const

// Category icons are stored by name in the database; unknown names fall back to a tag.
export function CategoryIcon({ name, className }: { name: string | null | undefined; className?: string }) {
  const Icon = (name && icons[name as keyof typeof icons]) || Tag
  return <Icon className={className} aria-hidden />
}
