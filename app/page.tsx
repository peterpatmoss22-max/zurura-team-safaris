const submitBooking = async () => {
    setBookingError('')
    setBookingSubmitting(true)
    try {
      const idempotencyKey = crypto.randomUUID()
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...bookingData, idempotencyKey }),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) throw new Error(result.error || 'We could not save your booking.')

      const bookingId = result?.booking?.id
      if (!bookingId) throw new Error('Your booking was created, but payment could not be initialized.')

      const paymentResponse = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId, method: 'paystack' }),
      })
      const paymentResult = await paymentResponse.json().catch(() => ({}))

      if (!paymentResponse.ok) {
        throw new Error(paymentResult.error || 'Paystack payment could not be initialized.')
      }

      setBookingReference(result.booking.booking_reference)

      if (paymentResult.authorization_url) {
        window.location.href = paymentResult.authorization_url
        return
      }

      setBookingStep('confirmation')
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : 'We could not save your booking. Please try again.')
    } finally {
      setBookingSubmitting(false)
    }
  }
