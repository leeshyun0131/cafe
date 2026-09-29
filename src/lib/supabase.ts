import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { OrderRecord } from '../types/cafe';

// 환경 변수에서 Supabase 설정값 로드
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// 유효한 URL 및 키가 설정되어 있는지 확인
export const isSupabaseConfigured: boolean = Boolean(
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project') &&
  supabaseAnonKey !== 'your-anon-key'
);

// Supabase 클라이언트 생성 (미설정 시 null)
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Supabase 테이블 `cafe_menu`의 데이터 모델 인터페이스
export interface CafeMenuRow {
  id?: number;
  customer_name: string;
  phone_number?: string | null;
  beverage: string;
  size: 'S' | 'M' | 'L';
  options: string[];
  quantity: number;
  requests?: string | null;
  total_price: number;
  created_at?: string;
}

/**
 * DB Row 데이터를 클라이언트 OrderRecord 형태로 변환
 */
export function mapRowToOrderRecord(row: CafeMenuRow): OrderRecord {
  return {
    id: String(row.id ?? Date.now()),
    customerName: row.customer_name,
    phoneNumber: row.phone_number || '',
    beverage: row.beverage,
    size: row.size,
    options: row.options || [],
    quantity: row.quantity,
    requests: row.requests || '',
    totalPrice: row.total_price,
    orderedAt: row.created_at
      ? new Date(row.created_at).toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : new Date().toLocaleTimeString('ko-KR', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }),
  };
}

/**
 * Supabase에서 최근 주문 목록 조회 (최대 20건)
 */
export async function getRecentOrders(): Promise<{ data: OrderRecord[]; error: string | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { data: [], error: 'Supabase가 설정되지 않았습니다.' };
  }

  try {
    const { data, error } = await supabase
      .from('cafe_menu')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      console.error('주문 목록 조회 실패:', error);
      return { data: [], error: error.message };
    }

    const records: OrderRecord[] = (data || []).map((row: CafeMenuRow) =>
      mapRowToOrderRecord(row)
    );
    return { data: records, error: null };
  } catch (err: any) {
    console.error('Supabase 조회 중 예외 발생:', err);
    return { data: [], error: err.message || '데이터를 불러오는 중 오류가 발생했습니다.' };
  }
}

/**
 * Supabase에 새 주문 추가
 */
export async function submitOrderToSupabase(order: {
  customerName: string;
  phoneNumber?: string;
  beverage: string;
  size: 'S' | 'M' | 'L';
  options: string[];
  quantity: number;
  requests?: string;
  totalPrice: number;
}): Promise<{ data: OrderRecord | null; error: string | null }> {
  if (!supabase || !isSupabaseConfigured) {
    return { data: null, error: 'Supabase 연결 정보가 없습니다 (.env 확인 필요).' };
  }

  try {
    const rowToInsert: Omit<CafeMenuRow, 'id' | 'created_at'> = {
      customer_name: order.customerName,
      phone_number: order.phoneNumber || null,
      beverage: order.beverage,
      size: order.size,
      options: order.options,
      quantity: order.quantity,
      requests: order.requests || null,
      total_price: order.totalPrice,
    };

    const { data, error } = await supabase
      .from('cafe_menu')
      .insert([rowToInsert])
      .select()
      .single();

    if (error) {
      console.error('Supabase 주문 등록 실패:', error);
      return { data: null, error: error.message };
    }

    return { data: mapRowToOrderRecord(data as CafeMenuRow), error: null };
  } catch (err: any) {
    console.error('Supabase 주문 추가 중 예외:', err);
    return { data: null, error: err.message || '주문 전송 중 예외가 발생했습니다.' };
  }
}

/**
 * 실시간 주문 변경 구독 (Supabase Realtime)
 */
export function subscribeToOrders(
  onInsert: (newOrder: OrderRecord) => void
): (() => void) | null {
  if (!supabase || !isSupabaseConfigured) return null;

  try {
    const channel = supabase
      .channel('cafe_menu_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'cafe_menu' },
        (payload) => {
          if (payload.new) {
            const mapped = mapRowToOrderRecord(payload.new as CafeMenuRow);
            onInsert(mapped);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  } catch (err) {
    console.warn('Realtime 구독 실패:', err);
    return null;
  }
}
