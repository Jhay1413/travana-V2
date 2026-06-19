CREATE INDEX "idx_booking_date_created" ON "booking_table" USING btree ("date_created");--> statement-breakpoint
CREATE INDEX "idx_booking_accomodation_booking_id" ON "booking_accomodation" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_booking_airport_parking_booking_id" ON "booking_airport_parking" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_booking_attraction_ticket_booking_id" ON "booking_attraction_ticket" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_booking_car_hire_booking_id" ON "booking_car_hire" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_booking_flights_booking_id" ON "booking_flights" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_booking_lounge_pass_booking_id" ON "booking_lounge_pass" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_booking_transfers_booking_id" ON "booking_transfers" USING btree ("booking_id");--> statement-breakpoint
CREATE INDEX "idx_quote_transaction_status" ON "quote_table" USING btree ("transaction_id","quote_status");--> statement-breakpoint
CREATE INDEX "idx_quote_accomodation_quote_id" ON "quote_accomodation" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_quote_airport_parking_quote_id" ON "quote_airport_parking" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_quote_attraction_ticket_quote_id" ON "quote_attraction_ticket" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_quote_car_hire_quote_id" ON "quote_car_hire" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_quote_flights_quote_id" ON "quote_flights" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_quote_lounge_pass_quote_id" ON "quote_lounge_pass" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_quote_transfers_quote_id" ON "quote_transfers" USING btree ("quote_id");--> statement-breakpoint
CREATE INDEX "idx_transaction_status_created" ON "transaction" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "idx_transaction_user_status_created" ON "transaction" USING btree ("user_id","status","created_at");