def calculate_position(capital: float, risk_percent: float, entry_price: float,
                       stop_loss: float, target_1: float = None, target_2: float = None) -> dict:
    risk_per_share = abs(entry_price - stop_loss)
    if risk_per_share == 0:
        return None

    risk_amount = capital * (risk_percent / 100)
    quantity = int(risk_amount / risk_per_share)

    if quantity == 0:
        return None

    amount_invested = quantity * entry_price
    capital_percent = (amount_invested / capital) * 100

    result = {
        "quantity": quantity,
        "amount_invested": round(amount_invested, 2),
        "risk_amount": round(risk_amount, 2),
        "risk_per_share": round(risk_per_share, 2),
        "capital_percent": round(capital_percent, 2),
    }

    if target_1:
        reward_1 = abs(target_1 - entry_price)
        result["risk_reward_1"] = round(reward_1 / risk_per_share, 2)
        result["target_1_pnl"] = round(quantity * reward_1, 2)

    if target_2:
        reward_2 = abs(target_2 - entry_price)
        result["risk_reward_2"] = round(reward_2 / risk_per_share, 2)
        result["target_2_pnl"] = round(quantity * reward_2, 2)

    return result
