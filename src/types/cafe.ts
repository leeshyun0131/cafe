/**
 * 카페 주문 관련 타입 정의 (한국어 주석 포함)
 */

// 음료 항목 인터페이스
export interface BeverageItem {
  id: string;
  name: string;
  price: number;
}

// 사이즈 옵션 인터페이스
export interface SizeOption {
  id: 'S' | 'M' | 'L';
  name: string;
  extraPrice: number;
}

// 추가 옵션 인터페이스
export interface ExtraOption {
  id: string;
  name: string;
  price: number;
}

// 접수된 주문 인터페이스
export interface OrderRecord {
  id: string;
  customerName: string;
  phoneNumber: string;
  beverage: string;
  size: 'S' | 'M' | 'L';
  options: string[];
  quantity: number;
  requests: string;
  totalPrice: number;
  orderedAt: string;
}
