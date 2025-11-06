
# Stripe Integration for Perpetual Licenses

## Overview
Handle one-time payments for:
- Solo Business ($399)
- Team Business ($899) 
- Enterprise Multi-Site ($1,799)
- Add-ons: Extra facilities ($400), extra seats ($50/$45)
- Support packages ($500-$1,750)

## Implementation Notes
- Use Stripe Checkout for one-time payments
- Store license details in database (not credits)
- Handle facility/seat expansion purchases
- Support service add-ons
- No recurring billing or credit consumption

## Required Endpoints
- `/checkout/create-session` - Generate Stripe checkout
- `/stripe/webhook` - Handle payment completion
- `/license/status` - Check current license limits
