export type Role = 'rider' | 'agency'
export type Page = 'home' | 'request' | 'trips' | 'help'
export type TripType = 'one-way' | 'round-trip'
export type TripStatus = 'Requested' | 'Scheduled' | 'Driver assigned' | 'Completed'

export type Trip = {
  id: string
  rider: string
  pickup: string
  destination: string
  date: string
  pickupTime: string
  returnTime?: string
  type: TripType
  status: TripStatus
  mobility: string
}

export type SosEvent = {
  id: string
  rider: string
  phone: string
  location: string
  createdAt: string
  status: 'Active' | 'Acknowledged'
}

export type RiderProfile = {
  id: string
  agencyId: string
  username: string
  fullName: string
  dateOfBirth: string
  phone: string
  address: string
  emergencyContactName: string
  emergencyContactPhone: string
  mobilityNeeds: string
  communicationPreference: 'voice' | 'text' | 'relay'
  status: 'active' | 'inactive'
  createdAt: string
}

export type SessionUser = {
  id: string
  role: 'rider' | 'dispatcher'
  displayName: string
  profile?: RiderProfile
}
