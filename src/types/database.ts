export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      analytics_events: {
        Row: {
          created_at: string
          event: Database["public"]["Enums"]["analytics_event"]
          id: number
          properties: NonNullable<Json>
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event: Database["public"]["Enums"]["analytics_event"]
          id?: never
          properties?: NonNullable<Json>
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event?: Database["public"]["Enums"]["analytics_event"]
          id?: never
          properties?: NonNullable<Json>
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      configuration: {
        Row: {
          description: string | null
          key: string
          updated_at: string
          value: NonNullable<Json>
        }
        Insert: {
          description?: string | null
          key: string
          updated_at?: string
          value: NonNullable<Json>
        }
        Update: {
          description?: string | null
          key?: string
          updated_at?: string
          value?: NonNullable<Json>
        }
        Relationships: []
      }
      conversation_members: {
        Row: {
          conversation_id: string
          is_active: boolean
          joined_at: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          is_active?: boolean
          joined_at?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          is_active?: boolean
          joined_at?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_members_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["conversation_kind"]
          last_message_at: string | null
          passenger_id: string | null
          trip_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["conversation_kind"]
          last_message_at?: string | null
          passenger_id?: string | null
          trip_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["conversation_kind"]
          last_message_at?: string | null
          passenger_id?: string | null
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      live_locations: {
        Row: {
          accuracy_m: number | null
          heading: number | null
          lat: number
          lng: number
          recorded_at: string
          speed_mps: number | null
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          heading?: number | null
          lat: number
          lng: number
          recorded_at: string
          speed_mps?: number | null
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          heading?: number | null
          lat?: number
          lng?: number
          recorded_at?: string
          speed_mps?: number | null
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "live_locations_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "live_locations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          sender_id: string | null
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          sender_id?: string | null
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          data: NonNullable<Json>
          id: string
          read_at: string | null
          related_trip_id: string | null
          related_user_id: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          data?: NonNullable<Json>
          id?: string
          read_at?: string | null
          related_trip_id?: string | null
          related_user_id?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          data?: NonNullable<Json>
          id?: string
          read_at?: string | null
          related_trip_id?: string | null
          related_user_id?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_related_trip_id_fkey"
            columns: ["related_trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_related_user_id_fkey"
            columns: ["related_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pickup_points: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          lat: number
          lng: number
          location: unknown
          name: string
          place_id: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lat: number
          lng: number
          location?: never
          name: string
          place_id?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          lat?: number
          lng?: number
          location?: never
          name?: string
          place_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pickup_points_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          corridor: string | null
          created_at: string
          id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["place_kind"]
          lat: number
          lng: number
          location: unknown
          name: string
          sort_order: number
        }
        Insert: {
          corridor?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind: Database["public"]["Enums"]["place_kind"]
          lat: number
          lng: number
          location?: never
          name: string
          sort_order?: number
        }
        Update: {
          corridor?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: Database["public"]["Enums"]["place_kind"]
          lat?: number
          lng?: number
          location?: never
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string | null
          completed_trips_count: number
          created_at: string
          full_name: string
          id: string
          phone_number: string | null
          rating_average: number
          rating_count: number
          updated_at: string
        }
        Insert: {
          avatar_path?: string | null
          bio?: string | null
          completed_trips_count?: number
          created_at?: string
          full_name?: string
          id: string
          phone_number?: string | null
          rating_average?: number
          rating_count?: number
          updated_at?: string
        }
        Update: {
          avatar_path?: string | null
          bio?: string | null
          completed_trips_count?: number
          created_at?: string
          full_name?: string
          id?: string
          phone_number?: string | null
          rating_average?: number
          rating_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      push_tokens: {
        Row: {
          platform: string
          token: string
          updated_at: string
          user_id: string
        }
        Insert: {
          platform: string
          token: string
          updated_at?: string
          user_id: string
        }
        Update: {
          platform?: string
          token?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_tokens_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          ratee_id: string
          rater_id: string
          stars: number
          trip_id: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id: string
          rater_id: string
          stars: number
          trip_id: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          ratee_id?: string
          rater_id?: string
          stars?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_ratee_id_fkey"
            columns: ["ratee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_rater_id_fkey"
            columns: ["rater_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_trips: {
        Row: {
          created_at: string
          creator_id: string
          currency: string
          departure_local_time: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          distance_m: number | null
          dropoff_point_id: string | null
          duration_s: number | null
          end_date: string | null
          expressway_option: Database["public"]["Enums"]["expressway_option"]
          id: string
          luggage_policy: Database["public"]["Enums"]["luggage_policy"]
          notes: string | null
          origin_lat: number
          origin_lng: number
          origin_name: string
          pickup_point_id: string | null
          route_geometry: unknown
          start_date: string
          status: Database["public"]["Enums"]["recurring_status"]
          suggested_contribution: number | null
          timezone: string
          total_seats: number
          updated_at: string
          vehicle_id: string
          weekdays: number[]
        }
        Insert: {
          created_at?: string
          creator_id: string
          currency: string
          departure_local_time: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          distance_m?: number | null
          dropoff_point_id?: string | null
          duration_s?: number | null
          end_date?: string | null
          expressway_option?: Database["public"]["Enums"]["expressway_option"]
          id?: string
          luggage_policy?: Database["public"]["Enums"]["luggage_policy"]
          notes?: string | null
          origin_lat: number
          origin_lng: number
          origin_name: string
          pickup_point_id?: string | null
          route_geometry?: unknown
          start_date: string
          status?: Database["public"]["Enums"]["recurring_status"]
          suggested_contribution?: number | null
          timezone: string
          total_seats: number
          updated_at?: string
          vehicle_id: string
          weekdays: number[]
        }
        Update: {
          created_at?: string
          creator_id?: string
          currency?: string
          departure_local_time?: string
          destination_lat?: number
          destination_lng?: number
          destination_name?: string
          distance_m?: number | null
          dropoff_point_id?: string | null
          duration_s?: number | null
          end_date?: string | null
          expressway_option?: Database["public"]["Enums"]["expressway_option"]
          id?: string
          luggage_policy?: Database["public"]["Enums"]["luggage_policy"]
          notes?: string | null
          origin_lat?: number
          origin_lng?: number
          origin_name?: string
          pickup_point_id?: string | null
          route_geometry?: unknown
          start_date?: string
          status?: Database["public"]["Enums"]["recurring_status"]
          suggested_contribution?: number | null
          timezone?: string
          total_seats?: number
          updated_at?: string
          vehicle_id?: string
          weekdays?: number[]
        }
        Relationships: [
          {
            foreignKeyName: "recurring_trips_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_trips_dropoff_point_id_fkey"
            columns: ["dropoff_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_trips_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id: string | null
          reporter_id: string | null
          status: Database["public"]["Enums"]["report_status"]
          trip_id: string | null
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reported_user_id?: string | null
          reporter_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          trip_id?: string | null
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reported_user_id?: string | null
          reporter_id?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          trip_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reports_reported_user_id_fkey"
            columns: ["reported_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_incidents: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["incident_kind"]
          minutes_before_departure: number | null
          recorded_by: string | null
          subject_user_id: string | null
          trip_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: Database["public"]["Enums"]["incident_kind"]
          minutes_before_departure?: number | null
          recorded_by?: string | null
          subject_user_id?: string | null
          trip_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["incident_kind"]
          minutes_before_departure?: number | null
          recorded_by?: string | null
          subject_user_id?: string | null
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_incidents_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_incidents_subject_user_id_fkey"
            columns: ["subject_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_incidents_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_members: {
        Row: {
          completed_at: string | null
          dropoff_point_id: string | null
          id: string
          joined_at: string
          pickup_point_id: string | null
          request_id: string | null
          role: Database["public"]["Enums"]["member_role"]
          seat_count: number
          status: Database["public"]["Enums"]["member_status"]
          trip_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          dropoff_point_id?: string | null
          id?: string
          joined_at?: string
          pickup_point_id?: string | null
          request_id?: string | null
          role: Database["public"]["Enums"]["member_role"]
          seat_count?: number
          status?: Database["public"]["Enums"]["member_status"]
          trip_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          dropoff_point_id?: string | null
          id?: string
          joined_at?: string
          pickup_point_id?: string | null
          request_id?: string | null
          role?: Database["public"]["Enums"]["member_role"]
          seat_count?: number
          status?: Database["public"]["Enums"]["member_status"]
          trip_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_members_dropoff_point_id_fkey"
            columns: ["dropoff_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "trip_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_requests: {
        Row: {
          created_at: string
          dropoff_point_id: string | null
          id: string
          message: string | null
          pickup_point_id: string | null
          requester_id: string
          responded_at: string | null
          seat_count: number
          status: Database["public"]["Enums"]["request_status"]
          trip_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dropoff_point_id?: string | null
          id?: string
          message?: string | null
          pickup_point_id?: string | null
          requester_id: string
          responded_at?: string | null
          seat_count: number
          status?: Database["public"]["Enums"]["request_status"]
          trip_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dropoff_point_id?: string | null
          id?: string
          message?: string | null
          pickup_point_id?: string | null
          requester_id?: string
          responded_at?: string | null
          seat_count?: number
          status?: Database["public"]["Enums"]["request_status"]
          trip_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_requests_dropoff_point_id_fkey"
            columns: ["dropoff_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_requester_id_fkey"
            columns: ["requester_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trip_requests_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trip_stops: {
        Row: {
          id: string
          lat: number
          lng: number
          name: string
          position: number
          trip_id: string
        }
        Insert: {
          id?: string
          lat: number
          lng: number
          name: string
          position: number
          trip_id: string
        }
        Update: {
          id?: string
          lat?: number
          lng?: number
          name?: string
          position?: number
          trip_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trip_stops_trip_id_fkey"
            columns: ["trip_id"]
            isOneToOne: false
            referencedRelation: "trips"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          available_seats: number | null
          cancellation_reason: string | null
          cancelled_at: string | null
          completed_at: string | null
          created_at: string
          creator_id: string
          currency: string
          departure_time: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          destination_point: unknown
          distance_m: number | null
          dropoff_point_id: string | null
          duration_s: number | null
          estimated_arrival: string | null
          expressway_option: Database["public"]["Enums"]["expressway_option"]
          id: string
          luggage_policy: Database["public"]["Enums"]["luggage_policy"]
          notes: string | null
          origin_lat: number
          origin_lng: number
          origin_name: string
          origin_point: unknown
          pickup_point_id: string | null
          recurring_trip_id: string | null
          reminder_sent_at: string | null
          reserved_seats: number
          route_geometry: unknown
          started_at: string | null
          status: Database["public"]["Enums"]["trip_status"]
          suggested_contribution: number | null
          total_seats: number
          trip_type: Database["public"]["Enums"]["trip_type"]
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          available_seats?: never
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          creator_id: string
          currency: string
          departure_time: string
          destination_lat: number
          destination_lng: number
          destination_name: string
          destination_point?: never
          distance_m?: number | null
          dropoff_point_id?: string | null
          duration_s?: number | null
          estimated_arrival?: string | null
          expressway_option?: Database["public"]["Enums"]["expressway_option"]
          id?: string
          luggage_policy?: Database["public"]["Enums"]["luggage_policy"]
          notes?: string | null
          origin_lat: number
          origin_lng: number
          origin_name: string
          origin_point?: never
          pickup_point_id?: string | null
          recurring_trip_id?: string | null
          reminder_sent_at?: string | null
          reserved_seats?: number
          route_geometry?: unknown
          started_at?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          suggested_contribution?: number | null
          total_seats: number
          trip_type: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          available_seats?: never
          cancellation_reason?: string | null
          cancelled_at?: string | null
          completed_at?: string | null
          created_at?: string
          creator_id?: string
          currency?: string
          departure_time?: string
          destination_lat?: number
          destination_lng?: number
          destination_name?: string
          destination_point?: never
          distance_m?: number | null
          dropoff_point_id?: string | null
          duration_s?: number | null
          estimated_arrival?: string | null
          expressway_option?: Database["public"]["Enums"]["expressway_option"]
          id?: string
          luggage_policy?: Database["public"]["Enums"]["luggage_policy"]
          notes?: string | null
          origin_lat?: number
          origin_lng?: number
          origin_name?: string
          origin_point?: never
          pickup_point_id?: string | null
          recurring_trip_id?: string | null
          reminder_sent_at?: string | null
          reserved_seats?: number
          route_geometry?: unknown
          started_at?: string | null
          status?: Database["public"]["Enums"]["trip_status"]
          suggested_contribution?: number | null
          total_seats?: number
          trip_type?: Database["public"]["Enums"]["trip_type"]
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "trips_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_dropoff_point_id_fkey"
            columns: ["dropoff_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_pickup_point_id_fkey"
            columns: ["pickup_point_id"]
            isOneToOne: false
            referencedRelation: "pickup_points"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_recurring_trip_id_fkey"
            columns: ["recurring_trip_id"]
            isOneToOne: false
            referencedRelation: "recurring_trips"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          colour: string
          created_at: string
          id: string
          make: string
          model: string
          owner_id: string
          photo_path: string | null
          registration_number: string
          seat_capacity: number
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
          year: number | null
        }
        Insert: {
          colour: string
          created_at?: string
          id?: string
          make: string
          model: string
          owner_id: string
          photo_path?: string | null
          registration_number: string
          seat_capacity: number
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          year?: number | null
        }
        Update: {
          colour?: string
          created_at?: string
          id?: string
          make?: string
          model?: string
          owner_id?: string
          photo_path?: string | null
          registration_number?: string
          seat_capacity?: number
          status?: Database["public"]["Enums"]["vehicle_status"]
          updated_at?: string
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assert_contribution: {
        Args: {
          p_amount: number
          p_distance_m: number
          p_expressway: Database["public"]["Enums"]["expressway_option"]
        }
        Returns: undefined
      }
      assert_meeting_point: { Args: { p_point_id: string }; Returns: undefined }
      assert_vehicle_for_trip: {
        Args: { p_creator: string; p_seats: number; p_vehicle_id: string }
        Returns: undefined
      }
      cancel_request: { Args: { p_request_id: string }; Returns: undefined }
      cancel_trip: {
        Args: { p_reason?: string; p_trip_id: string }
        Returns: undefined
      }
      cfg: { Args: { p_key: string }; Returns: Json }
      cfg_timezone: { Args: Record<PropertyKey, never>; Returns: string }
      complete_trip: { Args: { p_trip_id: string }; Returns: undefined }
      create_recurring_trip: { Args: { p: Json }; Returns: string }
      create_trip: { Args: { p: Json }; Returns: string }
      display_name: { Args: { p_user: string }; Returns: string }
      ensure_direct_conversation: {
        Args: { p_passenger: string; p_trip_id: string }
        Returns: string
      }
      ensure_group_membership: {
        Args: { p_active: boolean; p_trip_id: string; p_user: string }
        Returns: undefined
      }
      fail: { Args: { p_code: string; p_detail?: string }; Returns: undefined }
      finish_trip: { Args: { p_trip_id: string }; Returns: undefined }
      generate_recurring_instances: {
        Args: { p_recurring_id?: string }
        Returns: number
      }
      get_my_profile: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_path: string | null
          bio: string | null
          completed_trips_count: number
          created_at: string
          full_name: string
          id: string
          phone_number: string | null
          rating_average: number
          rating_count: number
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      get_trip_detail: { Args: { p_trip_id: string }; Returns: Json }
      has_trip_request: {
        Args: { p_trip_id: string; p_user_id: string }
        Returns: boolean
      }
      is_blocked_between: { Args: { a: string; b: string }; Returns: boolean }
      is_conversation_member: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      is_in_conversation: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      is_trip_creator: {
        Args: { p_trip_id: string; p_user_id: string }
        Returns: boolean
      }
      is_trip_participant: {
        Args: { p_trip_id: string; p_user_id: string }
        Returns: boolean
      }
      list_blocked_users: {
        Args: Record<PropertyKey, never>
        Returns: {
          avatar_path: string
          blocked_at: string
          full_name: string
          user_id: string
        }[]
      }
      list_conversations: {
        Args: { p_limit?: number; p_offset?: number }
        Returns: {
          avatar_path: string
          conversation_id: string
          is_active: boolean
          kind: Database["public"]["Enums"]["conversation_kind"]
          last_message: string
          last_message_at: string
          last_sender_id: string
          other_user_id: string
          title: string
          trip_id: string
          trip_label: string
          trip_status: Database["public"]["Enums"]["trip_status"]
          unread_count: number
        }[]
      }
      log_search: { Args: { p_props: Json }; Returns: undefined }
      mark_conversation_read: {
        Args: { p_conversation_id: string }
        Returns: undefined
      }
      my_trips: {
        Args: { p_limit?: number; p_offset?: number; p_past?: boolean }
        Returns: {
          available_seats: number
          creator_avatar_path: string
          creator_id: string
          creator_name: string
          departure_time: string
          destination_name: string
          estimated_arrival: string
          is_recurring: boolean
          member_status: Database["public"]["Enums"]["member_status"]
          origin_name: string
          pending_request_count: number
          request_id: string
          request_status: Database["public"]["Enums"]["request_status"]
          role: Database["public"]["Enums"]["member_role"]
          status: Database["public"]["Enums"]["trip_status"]
          total_seats: number
          trip_id: string
          trip_type: Database["public"]["Enums"]["trip_type"]
        }[]
      }
      my_vehicles: {
        Args: Record<PropertyKey, never>
        Returns: {
          colour: string
          created_at: string
          id: string
          make: string
          model: string
          owner_id: string
          photo_path: string | null
          registration_number: string
          seat_capacity: number
          status: Database["public"]["Enums"]["vehicle_status"]
          updated_at: string
          year: number | null
        }[]
        SetofOptions: {
          from: "*"
          to: "vehicles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      notify: {
        Args: {
          p_body: string
          p_data?: Json
          p_related_user?: string
          p_title: string
          p_trip?: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user: string
        }
        Returns: undefined
      }
      prepare_account_deletion: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      register_push_token: {
        Args: { p_platform: string; p_token: string }
        Returns: undefined
      }
      report_no_show: {
        Args: { p_trip_id: string; p_user_id: string }
        Returns: undefined
      }
      request_seat: {
        Args: {
          p_dropoff_point_id?: string
          p_message?: string
          p_pickup_point_id?: string
          p_seat_count: number
          p_trip_id: string
        }
        Returns: string
      }
      require_user: { Args: Record<PropertyKey, never>; Returns: string }
      respond_to_request: {
        Args: { p_accept: boolean; p_request_id: string }
        Returns: Database["public"]["Enums"]["request_status"]
      }
      run_trip_maintenance: { Args: Record<PropertyKey, never>; Returns: Json }
      search_trips: {
        Args: {
          p_date?: string
          p_destination_lat?: number
          p_destination_lng?: number
          p_expressway?: Database["public"]["Enums"]["expressway_option"]
          p_limit?: number
          p_offset?: number
          p_origin_lat?: number
          p_origin_lng?: number
          p_recurring_only?: boolean
          p_seats?: number
          p_time?: string
          p_trip_type?: Database["public"]["Enums"]["trip_type"]
        }
        Returns: Database["public"]["CompositeTypes"]["trip_search_result"][]
        SetofOptions: {
          from: "*"
          to: "trip_search_result"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      start_trip: { Args: { p_trip_id: string }; Returns: undefined }
      stop_sharing_location: { Args: { p_trip_id: string }; Returns: undefined }
      suggest_contribution: {
        Args: { p_distance_m: number; p_uses_expressway: boolean }
        Returns: {
          currency: string
          max_amount: number
          min_amount: number
        }[]
      }
      track: {
        Args: {
          p_event: Database["public"]["Enums"]["analytics_event"]
          p_props?: Json
          p_user: string
        }
        Returns: undefined
      }
      trip_label: { Args: { p_trip_id: string }; Returns: string }
      trip_transition_allowed: {
        Args: {
          p_from: Database["public"]["Enums"]["trip_status"]
          p_to: Database["public"]["Enums"]["trip_status"]
        }
        Returns: boolean
      }
      unread_counts: {
        Args: Record<PropertyKey, never>
        Returns: {
          messages: number
          notifications: number
        }[]
      }
      update_live_location: {
        Args: {
          p_accuracy_m?: number
          p_heading?: number
          p_lat: number
          p_lng: number
          p_recorded_at?: string
          p_speed_mps?: number
          p_trip_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      analytics_event:
        | "account_created"
        | "trip_created"
        | "trip_search"
        | "trip_request"
        | "trip_request_accepted"
        | "trip_request_declined"
        | "trip_started"
        | "trip_completed"
        | "trip_cancelled"
        | "rating_submitted"
        | "message_sent"
      conversation_kind: "direct" | "trip_group"
      expressway_option: "use" | "avoid" | "either"
      incident_kind:
        | "passenger_no_show"
        | "creator_no_show"
        | "cancellation"
        | "late_cancellation"
      luggage_policy: "none" | "small" | "medium" | "large"
      member_role: "creator" | "passenger"
      member_status: "confirmed" | "completed" | "cancelled" | "no_show"
      notification_type:
        | "seat_request_received"
        | "request_accepted"
        | "request_declined"
        | "request_cancelled"
        | "participant_joined"
        | "participant_left"
        | "trip_reminder"
        | "trip_starting"
        | "trip_completed"
        | "trip_cancelled"
        | "new_message"
        | "safety_alert"
      place_kind: "estate" | "neighbourhood" | "town" | "landmark"
      recurring_status: "active" | "paused" | "cancelled"
      report_reason:
        | "unsafe_driving"
        | "harassment"
        | "no_show"
        | "inappropriate_behaviour"
        | "fraud"
        | "vehicle_mismatch"
        | "other"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      request_status:
        | "pending"
        | "accepted"
        | "declined"
        | "cancelled"
        | "expired"
      trip_status:
        | "draft"
        | "open"
        | "full"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "expired"
      trip_type: "commute" | "intercity"
      vehicle_status: "active" | "inactive"
    }
    CompositeTypes: {
      trip_search_result: {
        id: string | null
        trip_type: Database["public"]["Enums"]["trip_type"] | null
        status: Database["public"]["Enums"]["trip_status"] | null
        origin_name: string | null
        destination_name: string | null
        departure_time: string | null
        estimated_arrival: string | null
        available_seats: number | null
        total_seats: number | null
        suggested_contribution: number | null
        currency: string | null
        expressway_option:
          | Database["public"]["Enums"]["expressway_option"]
          | null
        luggage_policy: Database["public"]["Enums"]["luggage_policy"] | null
        is_recurring: boolean | null
        distance_m: number | null
        duration_s: number | null
        pickup_point_name: string | null
        creator_id: string | null
        creator_name: string | null
        creator_avatar_path: string | null
        creator_rating_average: number | null
        creator_rating_count: number | null
        creator_completed_trips: number | null
        vehicle_make: string | null
        vehicle_model: string | null
        vehicle_colour: string | null
        origin_distance_m: number | null
        destination_distance_m: number | null
        time_difference_min: number | null
      }
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      analytics_event: [
        "account_created",
        "trip_created",
        "trip_search",
        "trip_request",
        "trip_request_accepted",
        "trip_request_declined",
        "trip_started",
        "trip_completed",
        "trip_cancelled",
        "rating_submitted",
        "message_sent",
      ],
      conversation_kind: ["direct", "trip_group"],
      expressway_option: ["use", "avoid", "either"],
      incident_kind: [
        "passenger_no_show",
        "creator_no_show",
        "cancellation",
        "late_cancellation",
      ],
      luggage_policy: ["none", "small", "medium", "large"],
      member_role: ["creator", "passenger"],
      member_status: ["confirmed", "completed", "cancelled", "no_show"],
      notification_type: [
        "seat_request_received",
        "request_accepted",
        "request_declined",
        "request_cancelled",
        "participant_joined",
        "participant_left",
        "trip_reminder",
        "trip_starting",
        "trip_completed",
        "trip_cancelled",
        "new_message",
        "safety_alert",
      ],
      place_kind: ["estate", "neighbourhood", "town", "landmark"],
      recurring_status: ["active", "paused", "cancelled"],
      report_reason: [
        "unsafe_driving",
        "harassment",
        "no_show",
        "inappropriate_behaviour",
        "fraud",
        "vehicle_mismatch",
        "other",
      ],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      request_status: [
        "pending",
        "accepted",
        "declined",
        "cancelled",
        "expired",
      ],
      trip_status: [
        "draft",
        "open",
        "full",
        "in_progress",
        "completed",
        "cancelled",
        "expired",
      ],
      trip_type: ["commute", "intercity"],
      vehicle_status: ["active", "inactive"],
    },
  },
} as const

