export function createPushStore(supabase) {
  return {
    async health() {
      const { error } = await supabase.from("push_subscriptions").select("id", { head: true }).limit(1);
      if (error) throw error;
    },

    async upsertSubscription(userId, subscription) {
      const { error } = await supabase.from("push_subscriptions").upsert({
        user_id: userId,
        endpoint: subscription.endpoint,
        keys: subscription.keys,
        subscription,
        updated_at: new Date().toISOString()
      }, { onConflict: "endpoint" });
      if (error) throw error;
    },

    async recordEvent(eventKey, userId, title) {
      const { error } = await supabase.from("push_notification_events").insert({ event_key: eventKey, user_id: userId, title });
      if (error?.code === "23505") return false;
      if (error) throw error;
      return true;
    },

    async getSubscriptions(userId) {
      const { data, error } = await supabase.from("push_subscriptions").select("id,subscription").eq("user_id", userId);
      if (error) throw error;
      return data || [];
    },

    async deleteSubscription(id) {
      const { error } = await supabase.from("push_subscriptions").delete().eq("id", id);
      if (error) throw error;
    }
  };
}
