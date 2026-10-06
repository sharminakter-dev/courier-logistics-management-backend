// courier gets 70% of the shipment price (change this number as needed)
export const COURIER_SHARE_PERCENT = 70;

export const calculateEarning = (shipmentPrice: number) =>
	Math.round(shipmentPrice * (COURIER_SHARE_PERCENT / 100) * 100) / 100;