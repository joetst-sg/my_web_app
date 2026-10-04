export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      analytics_events: {
        Row: {
          anon_id: string | null
          article_id: string | null
          brand_id: string | null
          category_id: string | null
          collection_id: string | null
          created_at: string
          event_type: string
          id: number
          metadata: Json
          product_id: string | null
          query: string | null
          user_id: string | null
        }
        Insert: {
          anon_id?: string | null
          article_id?: string | null
          brand_id?: string | null
          category_id?: string | null
          collection_id?: string | null
          created_at?: string
          event_type: string
          id?: never
          metadata?: Json
          product_id?: string | null
          query?: string | null
          user_id?: string | null
        }
        Update: {
          anon_id?: string | null
          article_id?: string | null
          brand_id?: string | null
          category_id?: string | null
          collection_id?: string | null
          created_at?: string
          event_type?: string
          id?: never
          metadata?: Json
          product_id?: string | null
          query?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "analytics_events_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["brand_id"]
          },
          {
            foreignKeyName: "analytics_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "analytics_events_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "analytics_events_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "analytics_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "analytics_events_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      article_categories: {
        Row: {
          article_id: string
          category_id: string
        }
        Insert: {
          article_id: string
          category_id: string
        }
        Update: {
          article_id?: string
          category_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_categories_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "article_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["category_id"]
          },
        ]
      }
      article_products: {
        Row: {
          article_id: string
          position: number
          product_id: string
        }
        Insert: {
          article_id: string
          position?: number
          product_id: string
        }
        Update: {
          article_id?: string
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_products_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "article_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      article_tags: {
        Row: {
          article_id: string
          tag_id: string
        }
        Insert: {
          article_id: string
          tag_id: string
        }
        Update: {
          article_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "article_tags_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "articles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "article_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      articles: {
        Row: {
          author_id: string | null
          content: string
          created_at: string
          excerpt: string | null
          featured_image_url: string | null
          id: string
          published_at: string | null
          reading_minutes: number
          scheduled_for: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          status: Database["public"]["Enums"]["article_status"]
          title: string
          type: Database["public"]["Enums"]["article_type"]
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          published_at?: string | null
          reading_minutes?: number
          scheduled_for?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["article_status"]
          title: string
          type?: Database["public"]["Enums"]["article_type"]
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: string
          created_at?: string
          excerpt?: string | null
          featured_image_url?: string | null
          id?: string
          published_at?: string | null
          reading_minutes?: number
          scheduled_for?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["article_status"]
          title?: string
          type?: Database["public"]["Enums"]["article_type"]
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity_id: string | null
          entity_type: string
          id: number
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type: string
          id?: never
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string
          id?: never
          metadata?: Json
        }
        Relationships: []
      }
      brand_followers: {
        Row: {
          brand_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          brand_id: string
          created_at?: string
          user_id?: string
        }
        Update: {
          brand_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "brand_followers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "brand_followers_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      brands: {
        Row: {
          cover_url: string | null
          created_at: string
          description: string | null
          follower_count: number
          id: string
          is_published: boolean
          is_verified: boolean
          logo_url: string | null
          name: string
          owner_id: string | null
          slug: string
          social_links: Json
          tagline: string | null
          updated_at: string
          website_url: string | null
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          follower_count?: number
          id?: string
          is_published?: boolean
          is_verified?: boolean
          logo_url?: string | null
          name: string
          owner_id?: string | null
          slug: string
          social_links?: Json
          tagline?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          description?: string | null
          follower_count?: number
          id?: string
          is_published?: boolean
          is_verified?: boolean
          logo_url?: string | null
          name?: string
          owner_id?: string | null
          slug?: string
          social_links?: Json
          tagline?: string | null
          updated_at?: string
          website_url?: string | null
        }
        Relationships: []
      }
      categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          follower_count: number
          hero_image_url: string | null
          icon: string | null
          id: string
          is_featured: boolean
          name: string
          parent_id: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          translations: Json
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          follower_count?: number
          hero_image_url?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean
          name: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          translations?: Json
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          follower_count?: number
          hero_image_url?: string | null
          icon?: string | null
          id?: string
          is_featured?: boolean
          name?: string
          parent_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          translations?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["category_id"]
          },
        ]
      }
      category_followers: {
        Row: {
          category_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          category_id: string
          created_at?: string
          user_id?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_followers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_followers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "category_followers_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["category_id"]
          },
        ]
      }
      category_mappings: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          priority: number
          source: string
          source_category: string
          updated_at: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          priority?: number
          source?: string
          source_category: string
          updated_at?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          priority?: number
          source?: string
          source_category?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "category_mappings_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["category_id"]
          },
        ]
      }
      collection_followers: {
        Row: {
          collection_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          collection_id: string
          created_at?: string
          user_id?: string
        }
        Update: {
          collection_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_followers_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
        ]
      }
      collection_products: {
        Row: {
          added_at: string
          collection_id: string
          note: string | null
          position: number
          product_id: string
        }
        Insert: {
          added_at?: string
          collection_id: string
          note?: string | null
          position?: number
          product_id: string
        }
        Update: {
          added_at?: string
          collection_id?: string
          note?: string | null
          position?: number
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_products_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          cover_image_url: string | null
          created_at: string
          description: string | null
          follower_count: number
          id: string
          is_editorial: boolean
          is_featured: boolean
          owner_id: string | null
          product_count: number
          slug: string
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["visibility"]
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          follower_count?: number
          id?: string
          is_editorial?: boolean
          is_featured?: boolean
          owner_id?: string | null
          product_count?: number
          slug: string
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string
          description?: string | null
          follower_count?: number
          id?: string
          is_editorial?: boolean
          is_featured?: boolean
          owner_id?: string | null
          product_count?: number
          slug?: string
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["visibility"]
        }
        Relationships: []
      }
      deals: {
        Row: {
          coupon_code: string | null
          created_at: string
          created_by: string | null
          deal_price: number
          ends_at: string | null
          id: string
          original_price: number | null
          product_id: string
          starts_at: string
          title: string | null
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          deal_price: number
          ends_at?: string | null
          id?: string
          original_price?: number | null
          product_id: string
          starts_at?: string
          title?: string | null
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          created_by?: string | null
          deal_price?: number
          ends_at?: string | null
          id?: string
          original_price?: number | null
          product_id?: string
          starts_at?: string
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          id: number
          last_error: string | null
          payload: Json
          sent_at: string | null
          status: string
          template: string
          to_email: string
          user_id: string | null
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: never
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          template: string
          to_email: string
          user_id?: string | null
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: never
          last_error?: string | null
          payload?: Json
          sent_at?: string | null
          status?: string
          template?: string
          to_email?: string
          user_id?: string | null
        }
        Relationships: []
      }
      featured_products: {
        Row: {
          created_at: string
          created_by: string | null
          ends_at: string | null
          id: string
          placement: Database["public"]["Enums"]["feature_placement"]
          position: number
          product_id: string
          starts_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          placement: Database["public"]["Enums"]["feature_placement"]
          position?: number
          product_id: string
          starts_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          placement?: Database["public"]["Enums"]["feature_placement"]
          position?: number
          product_id?: string
          starts_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "featured_products_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      homepage_sections: {
        Row: {
          config: Json
          id: string
          is_enabled: boolean
          position: number
          subtitle: string | null
          title: string | null
          translations: Json
          type: Database["public"]["Enums"]["homepage_section_type"]
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          id?: string
          is_enabled?: boolean
          position?: number
          subtitle?: string | null
          title?: string | null
          translations?: Json
          type: Database["public"]["Enums"]["homepage_section_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          id?: string
          is_enabled?: boolean
          position?: number
          subtitle?: string | null
          title?: string | null
          translations?: Json
          type?: Database["public"]["Enums"]["homepage_section_type"]
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          data: Json
          id: string
          link: string | null
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          data?: Json
          id?: string
          link?: string | null
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      product_categories: {
        Row: {
          category_id: string
          is_primary: boolean
          product_id: string
        }
        Insert: {
          category_id: string
          is_primary?: boolean
          product_id: string
        }
        Update: {
          category_id?: string
          is_primary?: boolean
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "product_categories_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["category_id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_categories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_images: {
        Row: {
          alt: string | null
          created_at: string
          height: number | null
          id: string
          original_url: string | null
          position: number
          product_id: string
          storage_path: string
          translations: Json
          width: number | null
        }
        Insert: {
          alt?: string | null
          created_at?: string
          height?: number | null
          id?: string
          original_url?: string | null
          position?: number
          product_id: string
          storage_path: string
          translations?: Json
          width?: number | null
        }
        Update: {
          alt?: string | null
          created_at?: string
          height?: number | null
          id?: string
          original_url?: string | null
          position?: number
          product_id?: string
          storage_path?: string
          translations?: Json
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_images_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_saves: {
        Row: {
          created_at: string
          product_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          product_id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          product_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_saves_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_saves_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_saves_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_scores: {
        Row: {
          design: number | null
          features: number | null
          innovation: number | null
          overall: number
          product_id: string
          reviewed_by: string | null
          updated_at: string
          usability: number | null
          value: number | null
          verdict: string | null
        }
        Insert: {
          design?: number | null
          features?: number | null
          innovation?: number | null
          overall: number
          product_id: string
          reviewed_by?: string | null
          updated_at?: string
          usability?: number | null
          value?: number | null
          verdict?: string | null
        }
        Update: {
          design?: number | null
          features?: number | null
          innovation?: number | null
          overall?: number
          product_id?: string
          reviewed_by?: string | null
          updated_at?: string
          usability?: number | null
          value?: number | null
          verdict?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_scores_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_scores_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_scores_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_source_metadata: {
        Row: {
          backer_count: number | null
          campaign_ends_at: string | null
          campaign_ends_at_estimated: boolean
          campaign_starts_at: string | null
          changed_fields: string[]
          created_at: string
          currency: string | null
          days_remaining: number | null
          goal_amount: number | null
          id: string
          import_mode: string
          ja_description: string | null
          ja_short_description: string | null
          ja_summary: string | null
          ja_summary_edited: boolean
          ja_title: string | null
          last_error: string | null
          last_synced_at: string | null
          needs_category_review: boolean
          owner_name: string | null
          pipeline_status: string
          price: number | null
          product_id: string | null
          raised_amount: number | null
          raw_metadata: Json
          reviewed_at: string | null
          reviewed_by: string | null
          skipped_image_urls: string[]
          source: string
          source_campaign_id: string
          source_categories: string[]
          source_content_hash: string | null
          source_language: string
          source_last_updated_at: string | null
          source_name: string | null
          source_status: string
          source_tags: string[]
          source_url: string
          summary_word_count: number | null
          translated_content_hash: string | null
          update_available: boolean
          updated_at: string
        }
        Insert: {
          backer_count?: number | null
          campaign_ends_at?: string | null
          campaign_ends_at_estimated?: boolean
          campaign_starts_at?: string | null
          changed_fields?: string[]
          created_at?: string
          currency?: string | null
          days_remaining?: number | null
          goal_amount?: number | null
          id?: string
          import_mode?: string
          ja_description?: string | null
          ja_short_description?: string | null
          ja_summary?: string | null
          ja_summary_edited?: boolean
          ja_title?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          needs_category_review?: boolean
          owner_name?: string | null
          pipeline_status?: string
          price?: number | null
          product_id?: string | null
          raised_amount?: number | null
          raw_metadata?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          skipped_image_urls?: string[]
          source?: string
          source_campaign_id: string
          source_categories?: string[]
          source_content_hash?: string | null
          source_language?: string
          source_last_updated_at?: string | null
          source_name?: string | null
          source_status?: string
          source_tags?: string[]
          source_url: string
          summary_word_count?: number | null
          translated_content_hash?: string | null
          update_available?: boolean
          updated_at?: string
        }
        Update: {
          backer_count?: number | null
          campaign_ends_at?: string | null
          campaign_ends_at_estimated?: boolean
          campaign_starts_at?: string | null
          changed_fields?: string[]
          created_at?: string
          currency?: string | null
          days_remaining?: number | null
          goal_amount?: number | null
          id?: string
          import_mode?: string
          ja_description?: string | null
          ja_short_description?: string | null
          ja_summary?: string | null
          ja_summary_edited?: boolean
          ja_title?: string | null
          last_error?: string | null
          last_synced_at?: string | null
          needs_category_review?: boolean
          owner_name?: string | null
          pipeline_status?: string
          price?: number | null
          product_id?: string | null
          raised_amount?: number | null
          raw_metadata?: Json
          reviewed_at?: string | null
          reviewed_by?: string | null
          skipped_image_urls?: string[]
          source?: string
          source_campaign_id?: string
          source_categories?: string[]
          source_content_hash?: string | null
          source_language?: string
          source_last_updated_at?: string | null
          source_name?: string | null
          source_status?: string
          source_tags?: string[]
          source_url?: string
          summary_word_count?: number | null
          translated_content_hash?: string | null
          update_available?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_source_metadata_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_source_metadata_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_source_metadata_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_specifications: {
        Row: {
          id: string
          label: string
          position: number
          product_id: string
          value: string
        }
        Insert: {
          id?: string
          label: string
          position?: number
          product_id: string
          value: string
        }
        Update: {
          id?: string
          label?: string
          position?: number
          product_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_specifications_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_tags: {
        Row: {
          product_id: string
          tag_id: string
        }
        Insert: {
          product_id: string
          tag_id: string
        }
        Update: {
          product_id?: string
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      product_translation_versions: {
        Row: {
          created_by: string | null
          description: string | null
          id: string
          image_alts: Json
          language: string
          origin: string
          product_id: string
          seo_description: string | null
          seo_title: string | null
          short_description: string | null
          source_content_hash: string | null
          title: string | null
          translated_at: string
          translation_model: string | null
          translation_provider: string | null
          version: number
        }
        Insert: {
          created_by?: string | null
          description?: string | null
          id?: string
          image_alts?: Json
          language: string
          origin: string
          product_id: string
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          source_content_hash?: string | null
          title?: string | null
          translated_at?: string
          translation_model?: string | null
          translation_provider?: string | null
          version: number
        }
        Update: {
          created_by?: string | null
          description?: string | null
          id?: string
          image_alts?: Json
          language?: string
          origin?: string
          product_id?: string
          seo_description?: string | null
          seo_title?: string | null
          short_description?: string | null
          source_content_hash?: string | null
          title?: string | null
          translated_at?: string
          translation_model?: string | null
          translation_provider?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_translation_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_translation_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_translation_versions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_videos: {
        Row: {
          created_at: string
          id: string
          position: number
          product_id: string
          provider: string
          title: string | null
          url: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          product_id: string
          provider?: string
          title?: string | null
          url: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          product_id?: string
          provider?: string
          title?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_videos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_videos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_videos_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      product_views: {
        Row: {
          anon_id: string | null
          created_at: string
          id: number
          product_id: string
          viewer_id: string | null
        }
        Insert: {
          anon_id?: string | null
          created_at?: string
          id?: never
          product_id: string
          viewer_id?: string | null
        }
        Update: {
          anon_id?: string | null
          created_at?: string
          id?: never
          product_id?: string
          viewer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_views_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          availability: Database["public"]["Enums"]["product_availability"]
          benefits: string[]
          brand_id: string | null
          click_count: number
          collection_count: number
          created_at: string
          currency: string
          description: string | null
          discount_percent: number | null
          external_url: string | null
          id: string
          key_features: string[]
          name: string
          original_price: number | null
          popularity_score: number
          price: number | null
          published_at: string | null
          sale_ends_at: string | null
          sale_starts_at: string | null
          save_count: number
          scheduled_for: string | null
          search_vector: unknown
          seller_id: string | null
          seo_description: string | null
          seo_title: string | null
          share_count: number
          sku: string | null
          slug: string
          status: Database["public"]["Enums"]["product_status"]
          tagline: string | null
          translations: Json
          trending_rank: number | null
          updated_at: string
          view_count: number
        }
        Insert: {
          availability?: Database["public"]["Enums"]["product_availability"]
          benefits?: string[]
          brand_id?: string | null
          click_count?: number
          collection_count?: number
          created_at?: string
          currency?: string
          description?: string | null
          discount_percent?: number | null
          external_url?: string | null
          id?: string
          key_features?: string[]
          name: string
          original_price?: number | null
          popularity_score?: number
          price?: number | null
          published_at?: string | null
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          save_count?: number
          scheduled_for?: string | null
          search_vector?: unknown
          seller_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          share_count?: number
          sku?: string | null
          slug: string
          status?: Database["public"]["Enums"]["product_status"]
          tagline?: string | null
          translations?: Json
          trending_rank?: number | null
          updated_at?: string
          view_count?: number
        }
        Update: {
          availability?: Database["public"]["Enums"]["product_availability"]
          benefits?: string[]
          brand_id?: string | null
          click_count?: number
          collection_count?: number
          created_at?: string
          currency?: string
          description?: string | null
          discount_percent?: number | null
          external_url?: string | null
          id?: string
          key_features?: string[]
          name?: string
          original_price?: number | null
          popularity_score?: number
          price?: number | null
          published_at?: string | null
          sale_ends_at?: string | null
          sale_starts_at?: string | null
          save_count?: number
          scheduled_for?: string | null
          search_vector?: unknown
          seller_id?: string | null
          seo_description?: string | null
          seo_title?: string | null
          share_count?: number
          sku?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["product_status"]
          tagline?: string | null
          translations?: Json
          trending_rank?: number | null
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "brands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_brand_id_fkey"
            columns: ["brand_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["brand_id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          is_public: boolean
          social_links: Json
          updated_at: string
          username: string | null
          website: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          is_public?: boolean
          social_links?: Json
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          is_public?: boolean
          social_links?: Json
          updated_at?: string
          username?: string | null
          website?: string | null
        }
        Relationships: []
      }
      rate_limit_hits: {
        Row: {
          hit_at: string
          key: string
        }
        Insert: {
          hit_at?: string
          key: string
        }
        Update: {
          hit_at?: string
          key?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          id: string
          note: string | null
          product_id: string
          remind_at: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["reminder_status"]
          type: Database["public"]["Enums"]["reminder_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          product_id: string
          remind_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          type: Database["public"]["Enums"]["reminder_type"]
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          product_id?: string
          remind_at?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["reminder_status"]
          type?: Database["public"]["Enums"]["reminder_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reminders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reminders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          product_id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string | null
          resolution_note: string | null
          resolved_by: string | null
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          product_id: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          product_id?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_by?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          description: string
          id: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          description: string
          id: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          description?: string
          id?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      seller_profiles: {
        Row: {
          bio: string | null
          company_name: string
          contact_email: string | null
          created_at: string
          logo_url: string | null
          social_links: Json
          updated_at: string
          user_id: string
          website: string | null
        }
        Insert: {
          bio?: string | null
          company_name: string
          contact_email?: string | null
          created_at?: string
          logo_url?: string | null
          social_links?: Json
          updated_at?: string
          user_id: string
          website?: string | null
        }
        Update: {
          bio?: string | null
          company_name?: string
          contact_email?: string | null
          created_at?: string
          logo_url?: string | null
          social_links?: Json
          updated_at?: string
          user_id?: string
          website?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      submission_messages: {
        Row: {
          author_id: string | null
          body: string
          created_at: string
          id: number
          submission_id: string
        }
        Insert: {
          author_id?: string | null
          body: string
          created_at?: string
          id?: never
          submission_id: string
        }
        Update: {
          author_id?: string | null
          body?: string
          created_at?: string
          id?: never
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_messages_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_reviews: {
        Row: {
          action: Database["public"]["Enums"]["review_action"]
          actor_id: string | null
          created_at: string
          from_status: Database["public"]["Enums"]["submission_status"]
          id: number
          message: string | null
          submission_id: string
          to_status: Database["public"]["Enums"]["submission_status"]
        }
        Insert: {
          action: Database["public"]["Enums"]["review_action"]
          actor_id?: string | null
          created_at?: string
          from_status: Database["public"]["Enums"]["submission_status"]
          id?: never
          message?: string | null
          submission_id: string
          to_status: Database["public"]["Enums"]["submission_status"]
        }
        Update: {
          action?: Database["public"]["Enums"]["review_action"]
          actor_id?: string | null
          created_at?: string
          from_status?: Database["public"]["Enums"]["submission_status"]
          id?: never
          message?: string | null
          submission_id?: string
          to_status?: Database["public"]["Enums"]["submission_status"]
        }
        Relationships: [
          {
            foreignKeyName: "submission_reviews_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          created_at: string
          id: string
          last_action_at: string
          product_id: string
          reviewer_id: string | null
          scheduled_for: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_action_at?: string
          product_id: string
          reviewer_id?: string | null
          scheduled_for?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_action_at?: string
          product_id?: string
          reviewer_id?: string | null
          scheduled_for?: string | null
          seller_id?: string | null
          status?: Database["public"]["Enums"]["submission_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "submissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: true
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_logs: {
        Row: {
          campaign_id: string | null
          campaign_url: string | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          id: number
          message: string | null
          operation: string
          product_id: string | null
          run_id: string | null
          source: string
          status: string
        }
        Insert: {
          campaign_id?: string | null
          campaign_url?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: never
          message?: string | null
          operation: string
          product_id?: string | null
          run_id?: string | null
          source?: string
          status: string
        }
        Update: {
          campaign_id?: string | null
          campaign_url?: string | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          id?: never
          message?: string | null
          operation?: string
          product_id?: string | null
          run_id?: string | null
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "sync_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sync_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "import_logs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sync_logs_run_id_fkey"
            columns: ["run_id"]
            isOneToOne: false
            referencedRelation: "sync_runs"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_runs: {
        Row: {
          discovered: number
          error_count: number
          finished_at: string | null
          id: string
          message: string | null
          mode: string
          new_count: number
          requests: number
          skipped_count: number
          source: string
          started_at: string
          status: string
          translated_count: number
          trigger: string
          updated_count: number
        }
        Insert: {
          discovered?: number
          error_count?: number
          finished_at?: string | null
          id?: string
          message?: string | null
          mode: string
          new_count?: number
          requests?: number
          skipped_count?: number
          source?: string
          started_at?: string
          status?: string
          translated_count?: number
          trigger: string
          updated_count?: number
        }
        Update: {
          discovered?: number
          error_count?: number
          finished_at?: string | null
          id?: string
          message?: string | null
          mode?: string
          new_count?: number
          requests?: number
          skipped_count?: number
          source?: string
          started_at?: string
          status?: string
          translated_count?: number
          trigger?: string
          updated_count?: number
        }
        Relationships: []
      }
      tag_mappings: {
        Row: {
          created_at: string
          id: string
          source: string
          source_tag: string
          tag_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          source?: string
          source_tag: string
          tag_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          source?: string
          source_tag?: string
          tag_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tag_mappings_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          slug?: string
        }
        Relationships: []
      }
      translation_jobs: {
        Row: {
          attempts: number
          created_at: string
          finished_at: string | null
          id: string
          last_error: string | null
          max_attempts: number
          product_id: string
          run_after: string
          source_content_hash: string
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          product_id: string
          run_after?: string
          source_content_hash: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          finished_at?: string | null
          id?: string
          last_error?: string | null
          max_attempts?: number
          product_id?: string
          run_after?: string
          source_content_hash?: string
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "translation_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "deal_cards"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "translation_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "translation_jobs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          granted_by: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          granted_by?: string | null
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          granted_by?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_role_fkey"
            columns: ["role"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_settings: {
        Row: {
          created_at: string
          notification_prefs: Json
          onboarded_at: string | null
          suspended_at: string | null
          suspended_reason: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          notification_prefs?: Json
          onboarded_at?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          notification_prefs?: Json
          onboarded_at?: string | null
          suspended_at?: string | null
          suspended_reason?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      deal_cards: {
        Row: {
          brand_name: string | null
          brand_slug: string | null
          category_id: string | null
          category_name: string | null
          category_slug: string | null
          category_translations: Json | null
          coupon_code: string | null
          currency: string | null
          deal_id: string | null
          deal_price: number | null
          deal_status: string | null
          discount_percent: number | null
          ends_at: string | null
          image_alt: string | null
          image_path: string | null
          name: string | null
          original_price: number | null
          product_id: string | null
          product_translations: Json | null
          score: number | null
          slug: string | null
          starts_at: string | null
          tagline: string | null
          title: string | null
        }
        Relationships: []
      }
      import_logs: {
        Row: {
          completed_at: string | null
          error_message: string | null
          execution_seconds: number | null
          id: string | null
          items_failed: number | null
          items_found: number | null
          items_new: number | null
          items_skipped: number | null
          items_updated: number | null
          metadata: Json | null
          mode: string | null
          source: string | null
          started_at: string | null
          status: string | null
          trigger: string | null
        }
        Insert: {
          completed_at?: string | null
          error_message?: string | null
          execution_seconds?: never
          id?: string | null
          items_failed?: number | null
          items_found?: number | null
          items_new?: number | null
          items_skipped?: number | null
          items_updated?: number | null
          metadata?: never
          mode?: string | null
          source?: string | null
          started_at?: string | null
          status?: string | null
          trigger?: string | null
        }
        Update: {
          completed_at?: string | null
          error_message?: string | null
          execution_seconds?: never
          id?: string | null
          items_failed?: number | null
          items_found?: number | null
          items_new?: number | null
          items_skipped?: number | null
          items_updated?: number | null
          metadata?: never
          mode?: string | null
          source?: string | null
          started_at?: string | null
          status?: string | null
          trigger?: string | null
        }
        Relationships: []
      }
      product_cards: {
        Row: {
          availability:
            | Database["public"]["Enums"]["product_availability"]
            | null
          brand_id: string | null
          brand_name: string | null
          brand_slug: string | null
          campaign_currency: string | null
          campaign_raised: number | null
          category_id: string | null
          category_ids: string[] | null
          category_name: string | null
          category_slug: string | null
          category_translations: Json | null
          click_count: number | null
          compare_at_price: number | null
          created_at: string | null
          currency: string | null
          deal_ends_at: string | null
          deal_id: string | null
          discount_percent: number | null
          id: string | null
          image_alt: string | null
          image_path: string | null
          is_featured: boolean | null
          is_new: boolean | null
          is_trending: boolean | null
          list_price: number | null
          name: string | null
          popularity_score: number | null
          price: number | null
          product_translations: Json | null
          published_at: string | null
          save_count: number | null
          score: number | null
          seller_id: string | null
          share_count: number | null
          slug: string | null
          source_name: string | null
          status: Database["public"]["Enums"]["product_status"] | null
          tagline: string | null
          trending_rank: number | null
          updated_at: string | null
          view_count: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_list_users: {
        Args: { page_limit?: number; page_offset?: number; search?: string }
        Returns: {
          avatar_url: string
          created_at: string
          display_name: string
          email: string
          email_confirmed_at: string
          id: string
          last_sign_in_at: string
          roles: Database["public"]["Enums"]["app_role"][]
          suspended_at: string
          total_count: number
          username: string
        }[]
      }
      analytics_summary: { Args: { days?: number }; Returns: Json }
      apply_submission_transition: {
        Args: {
          _action: Database["public"]["Enums"]["review_action"]
          _actor: string
          _message?: string
          _scheduled_for?: string
          _submission_id: string
        }
        Returns: {
          created_at: string
          id: string
          last_action_at: string
          product_id: string
          reviewer_id: string | null
          scheduled_for: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      article_visible: { Args: { _article_id: string }; Returns: boolean }
      campaign_info: {
        Args: { p_product_id: string }
        Returns: {
          backer_count: number
          campaign_ends_at: string
          campaign_ends_at_estimated: boolean
          currency: string
          days_remaining: number
          goal_amount: number
          last_synced_at: string
          raised_amount: number
          source: string
          source_name: string
          source_status: string
          source_url: string
        }[]
      }
      can_edit_brand: { Args: { _brand_id: string }; Returns: boolean }
      can_edit_collection: {
        Args: { _collection_id: string }
        Returns: boolean
      }
      can_edit_product: { Args: { _product_id: string }; Returns: boolean }
      cleanup_old_data: { Args: never; Returns: undefined }
      collection_visible: { Args: { _collection_id: string }; Returns: boolean }
      create_notification: {
        Args: {
          _body: string
          _data?: Json
          _link?: string
          _title: string
          _type: Database["public"]["Enums"]["notification_type"]
          _user_id: string
        }
        Returns: undefined
      }
      crowdfunding_duplicate_candidates: {
        Args: { _product_id: string }
        Returns: {
          name: string
          product_id: string
          reason: string
          similarity: number
          slug: string
        }[]
      }
      enqueue_email: {
        Args: { _payload?: Json; _template: string; _user_id: string }
        Returns: undefined
      }
      escape_like: { Args: { value: string }; Returns: string }
      find_duplicate_products: {
        Args: { _product_id: string }
        Returns: {
          brand_name: string
          name: string
          product_id: string
          reasons: string[]
          similarity: number
          slug: string
          status: Database["public"]["Enums"]["product_status"]
        }[]
      }
      greenfunding_tick: { Args: never; Returns: undefined }
      has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      is_active_user: { Args: never; Returns: boolean }
      is_admin: { Args: never; Returns: boolean }
      is_api_role: { Args: never; Returns: boolean }
      is_staff: { Args: never; Returns: boolean }
      kick_email_sender: { Args: never; Returns: undefined }
      next_submission_status: {
        Args: {
          _action: Database["public"]["Enums"]["review_action"]
          _from: Database["public"]["Enums"]["submission_status"]
        }
        Returns: Database["public"]["Enums"]["submission_status"]
      }
      normalize_url: { Args: { url: string }; Returns: string }
      personal_feed: {
        Args: { result_limit?: number; result_offset?: number }
        Returns: {
          product_id: string
          reason: string
          score: number
        }[]
      }
      popular_searches: {
        Args: { result_limit?: number }
        Returns: {
          query: string
          searches: number
        }[]
      }
      process_due_reminders: { Args: never; Returns: number }
      product_campaign_funding: {
        Args: { _product_id: string }
        Returns: {
          currency: string
          raised_amount: number
        }[]
      }
      product_source_name: { Args: { _product_id: string }; Returns: string }
      product_status_for: {
        Args: { _s: Database["public"]["Enums"]["submission_status"] }
        Returns: Database["public"]["Enums"]["product_status"]
      }
      product_visible: { Args: { _product_id: string }; Returns: boolean }
      publish_due: { Args: never; Returns: number }
      raise_if_rate_limited: {
        Args: {
          _key: string
          _max: number
          _message: string
          _window_seconds: number
        }
        Returns: undefined
      }
      rate_limit_hit: {
        Args: { _key: string; _max: number; _window_seconds: number }
        Returns: boolean
      }
      record_outbound_click: {
        Args: { anon_id?: string; product_id: string }
        Returns: string
      }
      refresh_popularity_scores: { Args: never; Returns: undefined }
      related_products: {
        Args: { _product_id: string; result_limit?: number }
        Returns: {
          product_id: string
          score: number
        }[]
      }
      retry_pending_emails: { Args: never; Returns: undefined }
      search_products: {
        Args: { q: string; result_limit?: number }
        Returns: {
          product_id: string
          rank: number
        }[]
      }
      search_suggest: { Args: { q: string }; Returns: Json }
      seller_product_stats: {
        Args: { days?: number }
        Returns: {
          clicks: number
          day: string
          product_id: string
          saves: number
          views: number
        }[]
      }
      set_user_role: {
        Args: {
          enabled: boolean
          role: Database["public"]["Enums"]["app_role"]
          target_user: string
        }
        Returns: undefined
      }
      set_user_suspended: {
        Args: { reason?: string; suspended: boolean; target_user: string }
        Returns: undefined
      }
      submission_missing_fields: {
        Args: { _product_id: string }
        Returns: string[]
      }
      submission_seller_contact: {
        Args: { _submission_id: string }
        Returns: {
          company_name: string
          contact_email: string
          email: string
          website: string
        }[]
      }
      submission_visible: { Args: { _submission_id: string }; Returns: boolean }
      submissions_open: { Args: never; Returns: boolean }
      track_event: {
        Args: {
          anon_id?: string
          article_id?: string
          brand_id?: string
          category_id?: string
          channel?: string
          collection_id?: string
          event_type: string
          product_id?: string
          query?: string
        }
        Returns: undefined
      }
      transition_submission: {
        Args: {
          action: Database["public"]["Enums"]["review_action"]
          message?: string
          scheduled_for?: string
          submission_id: string
        }
        Returns: {
          created_at: string
          id: string
          last_action_at: string
          product_id: string
          reviewer_id: string | null
          scheduled_for: string | null
          seller_id: string | null
          status: Database["public"]["Enums"]["submission_status"]
          submitted_at: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "submissions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      try_uuid: { Args: { value: string }; Returns: string }
      write_audit: {
        Args: {
          _action: string
          _entity_id: string
          _entity_type: string
          _metadata?: Json
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "user" | "seller" | "editor" | "admin"
      article_status:
        | "draft"
        | "review"
        | "scheduled"
        | "published"
        | "archived"
      article_type:
        | "review"
        | "hands_on"
        | "buying_guide"
        | "news"
        | "roundup"
        | "how_to"
        | "interview"
      feature_placement:
        | "hero"
        | "featured_today"
        | "featured_this_week"
        | "trending"
        | "editors_pick"
        | "new"
        | "coming_soon"
        | "deal"
      homepage_section_type:
        | "hero"
        | "trending_products"
        | "featured_categories"
        | "new_products"
        | "featured_collections"
        | "magazine"
        | "product_list"
        | "deals"
        | "editors_picks"
      notification_type:
        | "product_approved"
        | "product_rejected"
        | "changes_requested"
        | "product_published"
        | "product_price_changed"
        | "product_sale"
        | "reminder"
        | "new_follower"
        | "collection_activity"
        | "submission_received"
        | "system"
      product_availability:
        | "available"
        | "coming_soon"
        | "preorder"
        | "crowdfunding"
        | "sold_out"
        | "discontinued"
      product_status:
        | "draft"
        | "pending_review"
        | "changes_requested"
        | "approved"
        | "scheduled"
        | "published"
        | "rejected"
        | "archived"
      reminder_status: "pending" | "sent" | "cancelled"
      reminder_type: "launch" | "sale" | "custom"
      report_reason:
        | "broken_link"
        | "incorrect_information"
        | "offensive_content"
        | "misleading_information"
        | "copyright_concern"
        | "scam_suspicious"
        | "other"
      report_status: "open" | "reviewing" | "resolved" | "dismissed"
      review_action:
        | "submit"
        | "withdraw"
        | "start_review"
        | "request_changes"
        | "approve"
        | "reject"
        | "schedule"
        | "publish"
        | "archive"
      submission_status:
        | "draft"
        | "submitted"
        | "under_review"
        | "changes_requested"
        | "approved"
        | "scheduled"
        | "published"
        | "rejected"
        | "archived"
      visibility: "public" | "private"
    }
    CompositeTypes: {
      [_ in never]: never
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
      app_role: ["user", "seller", "editor", "admin"],
      article_status: ["draft", "review", "scheduled", "published", "archived"],
      article_type: [
        "review",
        "hands_on",
        "buying_guide",
        "news",
        "roundup",
        "how_to",
        "interview",
      ],
      feature_placement: [
        "hero",
        "featured_today",
        "featured_this_week",
        "trending",
        "editors_pick",
        "new",
        "coming_soon",
        "deal",
      ],
      homepage_section_type: [
        "hero",
        "trending_products",
        "featured_categories",
        "new_products",
        "featured_collections",
        "magazine",
        "product_list",
        "deals",
        "editors_picks",
      ],
      notification_type: [
        "product_approved",
        "product_rejected",
        "changes_requested",
        "product_published",
        "product_price_changed",
        "product_sale",
        "reminder",
        "new_follower",
        "collection_activity",
        "submission_received",
        "system",
      ],
      product_availability: [
        "available",
        "coming_soon",
        "preorder",
        "crowdfunding",
        "sold_out",
        "discontinued",
      ],
      product_status: [
        "draft",
        "pending_review",
        "changes_requested",
        "approved",
        "scheduled",
        "published",
        "rejected",
        "archived",
      ],
      reminder_status: ["pending", "sent", "cancelled"],
      reminder_type: ["launch", "sale", "custom"],
      report_reason: [
        "broken_link",
        "incorrect_information",
        "offensive_content",
        "misleading_information",
        "copyright_concern",
        "scam_suspicious",
        "other",
      ],
      report_status: ["open", "reviewing", "resolved", "dismissed"],
      review_action: [
        "submit",
        "withdraw",
        "start_review",
        "request_changes",
        "approve",
        "reject",
        "schedule",
        "publish",
        "archive",
      ],
      submission_status: [
        "draft",
        "submitted",
        "under_review",
        "changes_requested",
        "approved",
        "scheduled",
        "published",
        "rejected",
        "archived",
      ],
      visibility: ["public", "private"],
    },
  },
} as const
