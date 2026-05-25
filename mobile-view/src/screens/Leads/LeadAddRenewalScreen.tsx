import { useEffect } from 'react';
import { ActivityIndicator, View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

/** Legacy route — renewal flow lives on LeadsRenewalList (matches web /dashboard/leads/renewal). */
export default function LeadAddRenewalScreen({ navigation }: { navigation: { replace: (s: string) => void } }) {
  useEffect(() => {
    navigation.replace('LeadsRenewalList');
  }, [navigation]);

  return (
    <View style={styles.centered}>
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },
});
